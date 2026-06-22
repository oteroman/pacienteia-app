// Self-booking flow via WhatsApp:
// 1. NLU detects appointment_request → startBookingFlow() → numbered service menu
// 2. Patient picks service ("1") → system finds slots across all professionals
// 3. Patient picks slot ("2") → appointment created → confirmation sent
//
// The flow state is stored in conversations.booking_flow (JSONB) and expires after 30 min.

import { createAdminClient }    from '@/lib/supabase/admin'
import { sendWhatsAppText }      from '@/lib/whatsapp/send'
import { findAvailableSlots, type SlotOption } from '@/lib/whatsapp/reschedule'
import { firstNameOf, formatWeekdayDayLima, formatTimeLima } from '@/lib/whatsapp/reminders'
import { processIntake }         from '@/app/actions/intake'
import { sendPaymentRequest }    from '@/lib/payments'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

const FLOW_TTL_MS = 30 * 60 * 1000   // expire flow after 30 min of inactivity

interface ServiceOption {
  name:        string
  durationMin: number
}

interface BookingSlot extends SlotOption {
  professionalId?: string
}

interface BookingFlowState {
  step:                 'awaiting_service' | 'awaiting_slot'
  services?:            ServiceOption[]
  selectedService?:     string
  selectedDurationMin?: number
  professionalId?:      string
  slots?:               BookingSlot[]
  startedAt:            string
}

// ── Public: start the flow (called from NLU pipeline) ────────────────────────

export async function startBookingFlow(opts: {
  organizationId: string
  branchId:       string
  conversationId: string
  contactPhone:   string
  contactName:    string | null
}): Promise<void> {
  const sb = createAdminClient() as SB

  const [{ data: services }, { data: org }] = await Promise.all([
    sb.from('services')
      .select('name, duration_min')
      .eq('organization_id', opts.organizationId)
      .eq('is_active', true)
      .order('name'),
    sb.from('organizations').select('name').eq('id', opts.organizationId).single(),
  ])

  const clinicName = org?.name ?? 'nuestra clínica'
  const firstName  = firstNameOf(opts.contactName ?? opts.contactPhone)

  const serviceList: ServiceOption[] = ((services ?? []) as { name: string; duration_min: number | null }[])
    .map((s) => ({ name: s.name, durationMin: s.duration_min ?? 30 }))

  if (serviceList.length === 0) {
    await sendWhatsAppText({
      branchId: opts.branchId,
      to:       opts.contactPhone,
      body:     `Hola ${firstName}! Un agente de *${clinicName}* te contactará pronto para coordinar tu cita 😊`,
    })
    return
  }

  const lines = serviceList.map((s, i) => `*${i + 1}.* ${s.name}`).join('\n')
  const body  =
    `Hola ${firstName}! Con gusto te agendamos una cita 😊\n\n` +
    `¿Cuál de nuestros servicios te interesa?\n\n` +
    `${lines}\n\n` +
    `_Responde con el número de tu preferencia._`

  const state: BookingFlowState = {
    step:      'awaiting_service',
    services:  serviceList,
    startedAt: new Date().toISOString(),
  }

  await Promise.all([
    sendWhatsAppText({ branchId: opts.branchId, to: opts.contactPhone, body }),
    sb.from('conversations')
      .update({ booking_flow: state, booking_flow_updated_at: new Date().toISOString() })
      .eq('id', opts.conversationId),
  ])
}

// ── Public: handle incoming message if flow is active ────────────────────────

export async function handleBookingFlow(opts: {
  organizationId: string
  branchId:       string
  contactPhone:   string
  body:           string
}): Promise<boolean> {
  const sb = createAdminClient() as SB

  // Find active booking flow for this phone in this org
  const { data: conv } = await sb
    .from('conversations')
    .select('id, patient_id, contact_name, booking_flow, booking_flow_updated_at')
    .eq('organization_id', opts.organizationId)
    .eq('branch_id', opts.branchId)
    .eq('contact_phone', opts.contactPhone)
    .not('booking_flow', 'is', null)
    .order('booking_flow_updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!conv?.booking_flow) return false

  const state = conv.booking_flow as BookingFlowState

  // Expire stale flows
  const ageMs = Date.now() - new Date(state.startedAt).getTime()
  if (ageMs > FLOW_TTL_MS) {
    await clearFlow(sb, conv.id)
    return false
  }

  const choice = parseInt(opts.body.trim(), 10)

  if (state.step === 'awaiting_service') {
    return handleServiceChoice(sb, conv, state, opts, choice)
  }

  if (state.step === 'awaiting_slot') {
    return handleSlotChoice(sb, conv, state, opts, choice)
  }

  return false
}

// ── Step 1: patient picks a service ──────────────────────────────────────────

async function handleServiceChoice(
  sb:    SB,
  conv:  { id: string; patient_id: string | null; contact_name: string | null },
  state: BookingFlowState,
  opts:  { organizationId: string; branchId: string; contactPhone: string },
  choice: number,
): Promise<boolean> {
  const services = state.services ?? []
  const firstName = firstNameOf(conv.contact_name ?? opts.contactPhone)

  if (isNaN(choice) || choice < 1 || choice > services.length) {
    const options = services.map((_, i) => i + 1).join(', ')
    await sendWhatsAppText({
      branchId: opts.branchId,
      to:       opts.contactPhone,
      body:     `${firstName}, por favor responde con un número (${options}) para elegir el servicio.`,
    })
    return true
  }

  const picked = services[choice - 1]

  // Find available slots across all professionals
  const slots = await findSlotsAcrossProfessionals({
    sb,
    organizationId: opts.organizationId,
    branchId:       opts.branchId,
    durationMin:    picked.durationMin,
    count:          3,
  })

  const { data: org } = await sb.from('organizations').select('name').eq('id', opts.organizationId).single()
  const clinicName = org?.name ?? 'la clínica'

  if (slots.length === 0) {
    await clearFlow(sb, conv.id)
    await sendWhatsAppText({
      branchId: opts.branchId,
      to:       opts.contactPhone,
      body:
        `${firstName}, en este momento no encontramos horarios disponibles para *${picked.name}* en los próximos días 😔\n\n` +
        `Un agente de *${clinicName}* te contactará pronto para coordinar 📅`,
    })
    return true
  }

  const lines = slots.map((s, i) => `→ Escribe *${i + 1}* · ${s.label}`).join('\n')
  const body  =
    `Aquí tienes los próximos horarios disponibles para *${picked.name}* en *${clinicName}* 📅\n\n` +
    `${lines}\n\n` +
    `_Responde con el número de tu preferencia._`

  const newState: BookingFlowState = {
    step:                 'awaiting_slot',
    services,
    selectedService:      picked.name,
    selectedDurationMin:  picked.durationMin,
    slots,
    startedAt:            state.startedAt,
  }

  await Promise.all([
    sendWhatsAppText({ branchId: opts.branchId, to: opts.contactPhone, body }),
    sb.from('conversations')
      .update({ booking_flow: newState, booking_flow_updated_at: new Date().toISOString() })
      .eq('id', conv.id),
  ])

  return true
}

// ── Step 2: patient picks a slot ─────────────────────────────────────────────

async function handleSlotChoice(
  sb:    SB,
  conv:  { id: string; patient_id: string | null; contact_name: string | null },
  state: BookingFlowState,
  opts:  { organizationId: string; branchId: string; contactPhone: string },
  choice: number,
): Promise<boolean> {
  const slots     = state.slots ?? []
  const firstName = firstNameOf(conv.contact_name ?? opts.contactPhone)

  if (isNaN(choice) || choice < 1 || choice > slots.length) {
    const options = slots.map((_, i) => i + 1).join(', ')
    await sendWhatsAppText({
      branchId: opts.branchId,
      to:       opts.contactPhone,
      body:     `${firstName}, por favor responde con un número (${options}) para confirmar tu horario.`,
    })
    return true
  }

  const selectedSlot    = slots[choice - 1]
  const selectedService = state.selectedService ?? 'Consulta'

  const { data: org } = await sb.from('organizations').select('name').eq('id', opts.organizationId).single()
  const clinicName = org?.name ?? 'la clínica'

  await clearFlow(sb, conv.id)

  if (conv.patient_id) {
    // Known patient: create the appointment
    const { data: newApt } = await sb.from('appointments').insert({
      organization_id: opts.organizationId,
      branch_id:       opts.branchId,
      patient_id:      conv.patient_id,
      professional_id: selectedSlot.professionalId ?? null,
      treatment_type:  selectedService,
      scheduled_at:    selectedSlot.utcIso,
      status:          'confirmed',
    }).select('id').single()

    const day  = formatWeekdayDayLima(selectedSlot.utcIso)
    const time = formatTimeLima(selectedSlot.utcIso)

    await sendWhatsAppText({
      branchId: opts.branchId,
      to:       opts.contactPhone,
      body:
        `✅ ¡Listo, ${firstName}! Tu cita de *${selectedService}* fue agendada para el *${day}* a las *${time}* en *${clinicName}*.\n\n` +
        `Te enviaremos un recordatorio el día anterior. ¡Te esperamos! 😊`,
    })

    // Fire payment request asynchronously (does nothing if method is 'none')
    if (newApt?.id) {
      sendPaymentRequest({
        sb,
        organizationId: opts.organizationId,
        branchId:       opts.branchId,
        appointmentId:  newApt.id,
        contactPhone:   opts.contactPhone,
        patientName:    conv.contact_name,
        serviceName:    selectedService,
        scheduledAt:    selectedSlot.utcIso,
      }).catch((err) => console.error('[booking-flow payment]', err))
    }
  } else {
    // Unknown patient: create a lead intake so staff handles it via the /leads pipeline.
    // processIntake runs Gemini normalization + SLA + audit trail — fire & forget.
    const day  = formatWeekdayDayLima(selectedSlot.utcIso)
    const time = formatTimeLima(selectedSlot.utcIso)

    await processIntake({
      organizationId: opts.organizationId,
      branchId:       opts.branchId,
      channel:        'whatsapp',
      contactName:    conv.contact_name ?? undefined,
      contactPhone:   opts.contactPhone,
      rawContent:     `Solicitud de cita vía WhatsApp: ${selectedService} para el ${day} a las ${time}.`,
      metadata: {
        service:         selectedService,
        scheduled_at:    selectedSlot.utcIso,
        professional_id: selectedSlot.professionalId ?? null,
        conversation_id: conv.id,
        source:          'booking_flow',
      },
    }).catch((err) => console.error('[booking-flow intake]', err))

    await sendWhatsAppText({
      branchId: opts.branchId,
      to:       opts.contactPhone,
      body:
        `Gracias ${firstName}! Hemos registrado tu solicitud de cita de *${selectedService}* para el *${day}* a las *${time}*.\n\n` +
        `Un agente de *${clinicName}* confirmará tu cita en breve. 😊`,
    })
  }

  return true
}

// ── Find slots across all professionals ──────────────────────────────────────

async function findSlotsAcrossProfessionals(opts: {
  sb:             SB
  organizationId: string
  branchId:       string
  durationMin:    number
  count:          number
}): Promise<BookingSlot[]> {
  const { sb, organizationId, branchId, durationMin, count } = opts

  const { data: professionals } = await sb
    .from('professionals')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (!professionals || professionals.length === 0) return []

  const allSlots: BookingSlot[] = []

  for (const pro of professionals as { id: string }[]) {
    const slots = await findAvailableSlots({
      sb,
      organizationId,
      branchId,
      professionalId: pro.id,
      durationMin,
      count,
    })
    for (const s of slots) {
      allSlots.push({ ...s, professionalId: pro.id })
    }
    if (allSlots.length >= count * 2) break  // enough candidates
  }

  // Deduplicate by time (two pros might have same slot), keep earliest per unique utcIso
  const seen = new Set<string>()
  const deduped: BookingSlot[] = []
  for (const s of allSlots.sort((a, b) => a.utcIso.localeCompare(b.utcIso))) {
    if (!seen.has(s.utcIso)) {
      seen.add(s.utcIso)
      deduped.push(s)
    }
    if (deduped.length >= count) break
  }

  return deduped
}

async function clearFlow(sb: SB, conversationId: string): Promise<void> {
  await sb
    .from('conversations')
    .update({ booking_flow: null, booking_flow_updated_at: null })
    .eq('id', conversationId)
}
