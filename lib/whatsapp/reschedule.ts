// Automatic reschedule flow: proposes 3 available slots via WhatsApp when
// a patient replies "2" to an appointment reminder. Handles the full cycle:
// slot discovery → options message → patient selection → appointment update.

import { sendWhatsAppText } from './send'
import { firstNameOf, formatTimeLima, formatWeekdayDayLima } from './reminders'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = any

export interface SlotOption {
  utcIso: string   // ISO string stored in DB / used for appointment update
  label:  string   // Human-readable for the WhatsApp message
}

// ── Slot discovery ────────────────────────────────────────────────────────────

export async function findAvailableSlots(opts: {
  sb:               SupabaseAdminClient
  organizationId:   string
  branchId:         string
  professionalId:   string
  durationMin?:     number
  count?:           number
}): Promise<SlotOption[]> {
  const { sb, organizationId, branchId, professionalId, durationMin = 60, count = 3 } = opts

  const nowUtc     = new Date()
  const minSlotUtc = new Date(nowUtc.getTime() + 2 * 3600_000)   // at least 2h from now
  const maxSlotUtc = new Date(nowUtc.getTime() + 14 * 24 * 3600_000)

  const [schedulesRes, blocksRes, existingRes] = await Promise.all([
    sb.from('doctor_schedules')
      .select('day_of_week, start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('organization_id', organizationId)
      .eq('is_active', true),

    sb.from('schedule_blocks')
      .select('block_date')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .gte('block_date', limaDateStr(minSlotUtc))
      .lte('block_date', limaDateStr(maxSlotUtc)),

    sb.from('appointments')
      .select('scheduled_at')
      .eq('professional_id', professionalId)
      .eq('organization_id', organizationId)
      .gte('scheduled_at', minSlotUtc.toISOString())
      .lte('scheduled_at', maxSlotUtc.toISOString())
      .in('status', ['scheduled', 'confirmed']),
  ])

  const schedules: { day_of_week: number; start_time: string; end_time: string }[] =
    schedulesRes.data ?? []
  const blockedDates = new Set<string>((blocksRes.data ?? []).map((b: { block_date: string }) => b.block_date))

  // Each booked appointment blocks a 60-min window (default duration for conflict check)
  const booked: { startMs: number; endMs: number }[] = (existingRes.data ?? []).map(
    (a: { scheduled_at: string }) => {
      const s = new Date(a.scheduled_at).getTime()
      return { startMs: s, endMs: s + durationMin * 60_000 }
    }
  )

  // Group schedules by day_of_week
  const schedByDay = new Map<number, { start_time: string; end_time: string }[]>()
  for (const s of schedules) {
    if (!schedByDay.has(s.day_of_week)) schedByDay.set(s.day_of_week, [])
    schedByDay.get(s.day_of_week)!.push(s)
  }

  const available: SlotOption[] = []

  // Iterate through Lima dates from today+1 through +14 days
  let dateStr = limaDateStr(minSlotUtc)
  const endDateStr = limaDateStr(maxSlotUtc)

  while (dateStr <= endDateStr && available.length < count) {
    if (!blockedDates.has(dateStr)) {
      const dow          = limaDayOfWeek(dateStr)
      const daySchedules = schedByDay.get(dow) ?? []

      for (const sched of daySchedules) {
        if (available.length >= count) break

        const [sh, sm] = sched.start_time.split(':').map(Number)
        const [eh, em] = sched.end_time.split(':').map(Number)
        const schedEndMins = eh * 60 + em

        let slotH = sh
        let slotM = sm

        while (slotH * 60 + slotM + durationMin <= schedEndMins && available.length < count) {
          const slotUtcMs   = limaHHMMtoUtcMs(dateStr, slotH, slotM)
          const slotEndUtcMs = slotUtcMs + durationMin * 60_000

          if (slotUtcMs >= minSlotUtc.getTime()) {
            const hasConflict = booked.some(b => slotUtcMs < b.endMs && slotEndUtcMs > b.startMs)
            if (!hasConflict) {
              available.push({
                utcIso: new Date(slotUtcMs).toISOString(),
                label:  buildSlotLabel(dateStr, slotH, slotM),
              })
            }
          }

          // Advance 30 min
          slotM += 30
          if (slotM >= 60) { slotH += 1; slotM -= 60 }
        }
      }
    }

    dateStr = nextDateStr(dateStr)
  }

  return available
}

// ── Message builders ──────────────────────────────────────────────────────────

export function buildSlotsMessage(opts: {
  patientFirstName: string
  slots:            SlotOption[]
  clinicName:       string
}): string {
  const { patientFirstName, slots, clinicName } = opts
  const lines = slots.map((s, i) => `→ Escribe *${i + 1}* · ${s.label}`).join('\n')
  return (
    `Hola ${patientFirstName}, con gusto te buscamos otro horario 📅\n\n` +
    `Estos son los horarios disponibles en *${clinicName}*:\n\n` +
    `${lines}\n\n` +
    `_Responde con el número de tu preferencia._`
  )
}

export function buildNoSlotsMessage(opts: {
  patientFirstName: string
  clinicName:       string
}): string {
  const { patientFirstName, clinicName } = opts
  return (
    `Hola ${patientFirstName}, en este momento no encontramos horarios disponibles en los próximos días 😔\n\n` +
    `Un agente de *${clinicName}* se comunicará contigo pronto para coordinar 📅`
  )
}

export function buildRescheduleConfirmedMessage(opts: {
  patientFirstName: string
  slot:             SlotOption
  clinicName:       string
}): string {
  const { patientFirstName, slot, clinicName } = opts
  const day  = formatWeekdayDayLima(slot.utcIso)
  const time = formatTimeLima(slot.utcIso)
  return (
    `✅ ¡Listo, ${patientFirstName}! Tu cita fue reagendada para el *${day}* a las *${time}* en *${clinicName}*.\n\n` +
    `Te esperamos 😊`
  )
}

export function buildInvalidSelectionMessage(patientFirstName: string, slotCount: number): string {
  const options = Array.from({ length: slotCount }, (_, i) => i + 1).join(', ')
  return `${patientFirstName}, por favor responde con un número (${options}) para seleccionar tu horario.`
}

// ── Slot selection handler ────────────────────────────────────────────────────

// Called from the webhook BEFORE handleReminderReply.
// Returns true if the message was a valid slot selection (consume the event).
export async function handleRescheduleSelection(opts: {
  sb:             SupabaseAdminClient
  organizationId: string
  branchId:       string
  contactPhone:   string
  body:           string
}): Promise<boolean> {
  const { sb, organizationId, branchId, contactPhone, body } = opts

  const normalized = body.trim()
  const choice     = parseInt(normalized, 10)
  if (isNaN(choice) || choice < 1 || choice > 9) return false

  // Look for a pending reschedule with proposed slots for this phone
  const { data: reminder } = await sb
    .from('appointment_reminders')
    .select('id, appointment_id, patient_id, reschedule_options')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .eq('contact_phone', contactPhone)
    .eq('status', 'reschedule_requested')
    .not('reschedule_options', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  if (!reminder?.reschedule_options) return false

  const slots: SlotOption[] = reminder.reschedule_options
  const selected = slots[choice - 1]

  if (!selected) {
    // Patient typed an out-of-range number — nudge them
    const [{ data: patient }, { data: org }] = await Promise.all([
      sb.from('patients').select('full_name').eq('id', reminder.patient_id).single(),
      sb.from('organizations').select('name').eq('id', organizationId).single(),
    ])
    const firstName = patient ? firstNameOf(patient.full_name) : 'Paciente'
    await sendWhatsAppText({
      branchId,
      to: contactPhone,
      body: buildInvalidSelectionMessage(firstName, slots.length),
    })
    return true  // still consumed — don't trigger other handlers
  }

  const [{ data: patient }, { data: org }] = await Promise.all([
    sb.from('patients').select('full_name').eq('id', reminder.patient_id).single(),
    sb.from('organizations').select('name').eq('id', organizationId).single(),
  ])

  const patientFirstName = patient ? firstNameOf(patient.full_name) : 'Paciente'
  const clinicName       = org?.name ?? 'la clínica'

  await Promise.all([
    sb.from('appointments')
      .update({ scheduled_at: selected.utcIso, status: 'confirmed' })
      .eq('id', reminder.appointment_id),
    sb.from('appointment_reminders')
      .update({ status: 'rescheduled', responded_at: new Date().toISOString() })
      .eq('id', reminder.id),
  ])

  await sendWhatsAppText({
    branchId,
    to: contactPhone,
    body: buildRescheduleConfirmedMessage({ patientFirstName, slot: selected, clinicName }),
  })

  return true
}

// ── Timezone helpers (Lima = UTC-5, no DST) ───────────────────────────────────

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000

function limaDateStr(utcDate: Date): string {
  // Returns YYYY-MM-DD in Lima local time
  const limaMs = utcDate.getTime() - LIMA_OFFSET_MS
  return new Date(limaMs).toISOString().split('T')[0]
}

function limaDayOfWeek(dateStr: string): number {
  // Returns 0=Sunday for a Lima YYYY-MM-DD date string
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay()
}

function limaHHMMtoUtcMs(dateStr: string, hh: number, mm: number): number {
  // Lima is UTC-5: UTC = Lima + 5h
  const [y, mo, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, mo - 1, d, hh + 5, mm, 0, 0)
}

function nextDateStr(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d + 1, 12)).toISOString().split('T')[0]
}

function buildSlotLabel(dateStr: string, h: number, m: number): string {
  const utcIso = new Date(limaHHMMtoUtcMs(dateStr, h, m)).toISOString()
  const day    = formatWeekdayDayLima(utcIso)
  const time   = formatTimeLima(utcIso)
  return `${day} a las ${time}`
}
