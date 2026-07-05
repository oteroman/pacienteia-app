import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppText }  from '@/lib/whatsapp/send'

// ── Types ─────────────────────────────────────────────────────
export type SlotReason  = 'cancellation' | 'no_show' | 'reschedule' | 'manual' | 'gap_detected'
export type SlotStatus  = 'open' | 'filled' | 'expired'

export interface Candidate {
  patientId:    string
  patientName:  string
  phone:        string
  score:        number
  scoreReasons: string[]
  isWaitlisted: boolean
  waMessage:    string
}

export interface SlotOpening {
  id:                string
  organizationId:    string
  appointmentId:     string | null
  treatmentType:     string
  slotStart:         string
  slotEnd:           string | null
  reasonOpened:      SlotReason
  status:            SlotStatus
  candidates:        Candidate[]
  candidateCount:    number
  notifiedPhones:    string[]
  selectedPatientId: string | null
  newAppointmentId:  string | null
  fillAttempts:      number
  staffTaskId:       string | null
  filledAt:          string | null
  notes:             string | null
  createdAt:         string
}

export interface BackfillDashboard {
  stats: {
    open:        number
    filledToday: number
    fillRate:    number
    totalSlots:  number
  }
  openSlots:   SlotOpening[]
  filledToday: SlotOpening[]
}

// ── Message template ──────────────────────────────────────────
function buildWaMessage(
  patientName:   string,
  treatmentType: string,
  slotStart:     string,
): string {
  const formatted = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(slotStart))

  return (
    `Hola ${patientName} 👋 Tenemos disponibilidad de última hora para *${treatmentType}* ` +
    `el *${formatted}*.\n\n` +
    `¿Te gustaría tomar este espacio? Responde *SÍ* para confirmarte 😊`
  )
}

// ── Candidate scoring ─────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  organizationId: string,
  treatmentType: string,
  slotStart:     string,
  limit = 5,
): Promise<Candidate[]> {
  const now           = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90  * 24 * 60 * 60 * 1000).toISOString()
  const oneYearAgo    = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const isUrgent      = new Date(slotStart).getTime() - now.getTime() < 48 * 60 * 60 * 1000

  const map = new Map<string, Omit<Candidate, 'waMessage'>>()

  // Source 1: patients who have had the same treatment before
  const { data: histRows } = await sb
    .from('appointments')
    .select('patient_id, scheduled_at, patients ( id, full_name, phone, on_waitlist )')
    .eq('organization_id', organizationId)
    .eq('treatment_type', treatmentType)
    .in('status', ['completed', 'confirmed'])
    .gte('scheduled_at', oneYearAgo)
    .order('scheduled_at', { ascending: false })
    .limit(60)

  for (const row of (histRows ?? [])) {
    const p = row.patients
    if (!p?.phone) continue
    const id = p.id as string
    if (map.has(id)) continue

    const isRecent = new Date(row.scheduled_at) >= new Date(ninetyDaysAgo)
    const reasons: string[] = ['Mismo tratamiento previo']
    let score = 30
    if (isRecent)      { score += 15; reasons.push('Visita reciente (<90d)') }
    if (p.on_waitlist) { score += 10; reasons.push('En lista de espera') }
    if (isUrgent)      { score += 5;  reasons.push('Slot urgente') }

    map.set(id, {
      patientId: id, patientName: p.full_name, phone: p.phone,
      score, scoreReasons: reasons, isWaitlisted: !!p.on_waitlist,
    })
  }

  // Source 2: open intake/lead requests for appointment
  const { data: inRows } = await sb
    .from('intakes')
    .select('patient_id, patients ( id, full_name, phone, on_waitlist )')
    .eq('organization_id', organizationId)
    .eq('detected_intent', 'appointment_request')
    .in('status', ['new', 'in_progress'])
    .not('patient_id', 'is', null)
    .limit(30)

  for (const row of (inRows ?? [])) {
    const p = row.patients
    if (!p?.phone) continue
    const id = p.id as string
    if (map.has(id)) {
      const c = map.get(id)!
      c.score += 15
      c.scoreReasons.push('Solicitud de cita abierta')
    } else {
      const reasons = ['Solicitud de cita abierta']
      let score = 25
      if (p.on_waitlist) { score += 10; reasons.push('En lista de espera') }
      if (isUrgent)      { score += 5;  reasons.push('Slot urgente') }
      map.set(id, {
        patientId: id, patientName: p.full_name, phone: p.phone,
        score, scoreReasons: reasons, isWaitlisted: !!p.on_waitlist,
      })
    }
  }

  // Source 3: active reactivation campaign patients (already warmed up)
  const { data: reacRows } = await sb
    .from('reactivation_campaigns')
    .select('patient_id, patients ( id, full_name, phone, on_waitlist )')
    .eq('organization_id', organizationId)
    .in('status', ['sent', 'responded'])
    .not('patient_id', 'is', null)
    .limit(30)

  for (const row of (reacRows ?? [])) {
    const p = row.patients
    if (!p?.phone) continue
    const id = p.id as string
    if (map.has(id)) {
      const c = map.get(id)!
      c.score += 20
      c.scoreReasons.push('En campaña de reactivación')
    } else {
      const reasons = ['En campaña de reactivación']
      let score = 35
      if (p.on_waitlist) { score += 10; reasons.push('En lista de espera') }
      if (isUrgent)      { score += 5;  reasons.push('Slot urgente') }
      map.set(id, {
        patientId: id, patientName: p.full_name, phone: p.phone,
        score, scoreReasons: reasons, isWaitlisted: !!p.on_waitlist,
      })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => ({
      ...c,
      score:     Math.min(c.score, 100),
      waMessage: buildWaMessage(c.patientName, treatmentType, slotStart),
    }))
}

// ── Core trigger ──────────────────────────────────────────────
export interface TriggerBackfillInput {
  organizationId: string
  branchId?:      string
  appointmentId:  string | null
  treatmentType:  string
  slotStart:      string
  slotEnd?:       string
  reasonOpened:   SlotReason
}

export async function triggerBackfill(input: TriggerBackfillInput): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const candidates = await findCandidates(sb, input.organizationId, input.treatmentType, input.slotStart)

  // Create copilot task for top candidate
  let staffTaskId: string | null = null
  if (candidates.length > 0 && input.branchId) {
    const top = candidates[0]
    const { data: task } = await sb.from('copilot_tasks').insert({
      organization_id: input.organizationId,
      branch_id:       input.branchId,
      patient_id:      top.patientId,
      title:           `Backfill: contactar ${top.patientName} — ${input.treatmentType}`,
      description:     `Score ${top.score}/100. Tel: ${top.phone}. ${top.scoreReasons.join(', ')}.`,
      priority:        'medium',
    }).select('id').single()
    staffTaskId = task?.id ?? null
  }

  // Create the slot_openings record FIRST — WhatsApp replies reference it via slot_id
  const { data: record, error } = await sb.from('slot_openings').insert({
    organization_id:  input.organizationId,
    branch_id:        input.branchId ?? null,
    appointment_id:   input.appointmentId,
    treatment_type:   input.treatmentType,
    slot_start:       input.slotStart,
    slot_end:         input.slotEnd ?? null,
    reason_opened:    input.reasonOpened,
    candidates,
    candidate_count:  candidates.length,
    notified_phones:  [],
    staff_task_id:    staffTaskId,
  }).select('id').single()

  if (error) {
    console.error('[triggerBackfill]', error.message)
    return null
  }

  // Now send WhatsApp — record exists so replies can be tracked
  const notifiedPhones: string[] = []
  if (input.branchId) {
    const toNotify = candidates.slice(0, 3)
    await Promise.allSettled(
      toNotify.map(async (c) => {
        try {
          await sendWhatsAppText({ branchId: input.branchId!, to: c.phone, body: c.waMessage })
          notifiedPhones.push(c.phone)
        } catch (err) {
          console.error('[backfill] sendWhatsApp failed for', c.phone, err)
        }
      })
    )
    if (notifiedPhones.length > 0) {
      await sb.from('slot_openings').update({ notified_phones: notifiedPhones }).eq('id', record.id)
    }
  }

  return record?.id as string | null
}

// ── Dashboard query ───────────────────────────────────────────
export async function fetchBackfillDashboard(organizationId: string): Promise<BackfillDashboard> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb          = createAdminClient() as any
  const now         = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const thirtyAgo   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const sel = `id, organization_id, appointment_id, treatment_type, slot_start, slot_end,
    reason_opened, status, candidates, candidate_count, notified_phones,
    selected_patient_id, new_appointment_id, fill_attempts,
    staff_task_id, filled_at, notes, created_at`

  const [openRes, filledRes, rateRes] = await Promise.all([
    sb.from('slot_openings').select(sel)
      .eq('organization_id', organizationId).eq('status', 'open')
      .order('slot_start', { ascending: true }).limit(30),

    sb.from('slot_openings').select(sel)
      .eq('organization_id', organizationId).eq('status', 'filled')
      .gte('filled_at', todayStart).order('filled_at', { ascending: false }).limit(20),

    sb.from('slot_openings').select('status')
      .eq('organization_id', organizationId).gte('created_at', thirtyAgo),
  ])

  const toSlot = (r: Record<string, unknown>): SlotOpening => ({
    id:                r.id as string,
    organizationId:    r.organization_id as string,
    appointmentId:     r.appointment_id as string | null,
    treatmentType:     r.treatment_type as string,
    slotStart:         r.slot_start as string,
    slotEnd:           r.slot_end as string | null,
    reasonOpened:      r.reason_opened as SlotReason,
    status:            r.status as SlotStatus,
    candidates:        (r.candidates as Candidate[]) ?? [],
    candidateCount:    r.candidate_count as number,
    notifiedPhones:    (r.notified_phones as string[]) ?? [],
    selectedPatientId: r.selected_patient_id as string | null,
    newAppointmentId:  r.new_appointment_id as string | null,
    fillAttempts:      r.fill_attempts as number,
    staffTaskId:       r.staff_task_id as string | null,
    filledAt:          r.filled_at as string | null,
    notes:             r.notes as string | null,
    createdAt:         r.created_at as string,
  })

  const rateRows  = (rateRes.data ?? []) as { status: string }[]
  const totalSlots  = rateRows.length
  const filledSlots = rateRows.filter((r) => r.status === 'filled').length

  return {
    stats: {
      open:        (openRes.data ?? []).length,
      filledToday: (filledRes.data ?? []).length,
      fillRate:    totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
      totalSlots,
    },
    openSlots:   (openRes.data   ?? []).map(toSlot),
    filledToday: (filledRes.data ?? []).map(toSlot),
  }
}

export async function fillSlot(
  slotId:            string,
  organizationId:    string,
  selectedPatientId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Read the slot first: we need branch + treatment to value the recovery,
  // and the prior status to keep the revenue count idempotent.
  const { data: slot } = await sb
    .from('slot_openings')
    .select('id, branch_id, treatment_type, appointment_id, status')
    .eq('id', slotId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  await sb
    .from('slot_openings')
    .update({ status: 'filled', selected_patient_id: selectedPatientId, filled_at: new Date().toISOString(), fill_attempts: 1 })
    .eq('id', slotId)
    .eq('organization_id', organizationId)

  // Count recovered revenue only on the first transition into 'filled'.
  if (slot && slot.status !== 'filled' && slot.branch_id) {
    const price = await resolveRecoveredPrice(sb, organizationId, slot)
    if (price > 0) {
      await recordRecoveredRevenue(sb, organizationId, slot.branch_id, price)
    }
  }
}

// ── Recovered-revenue counter ─────────────────────────────────
// Feeds metrics_daily.estimated_revenue_recovered — the "S/ recuperados
// este mes" hero number on the dashboard. Values the freed slot from the
// original appointment price, falling back to the service catalog.
interface SlotForPricing {
  treatment_type: string | null
  appointment_id: string | null
}

async function resolveRecoveredPrice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  organizationId: string,
  slot: SlotForPricing,
): Promise<number> {
  // 1. The price of the appointment that fell through — the money actually at risk.
  if (slot.appointment_id) {
    const { data: apt } = await sb
      .from('appointments')
      .select('price')
      .eq('id', slot.appointment_id)
      .maybeSingle()
    const p = Number(apt?.price ?? 0)
    if (p > 0) return p
  }

  // 2. Service catalog price for the same treatment.
  if (slot.treatment_type) {
    const { data: svc } = await sb
      .from('services')
      .select('price')
      .eq('organization_id', organizationId)
      .eq('name', slot.treatment_type)
      .eq('is_active', true)
      .not('price', 'is', null)
      .limit(1)
      .maybeSingle()
    const p = Number(svc?.price ?? 0)
    if (p > 0) return p
  }

  // 3. No reliable price — don't invent one.
  return 0
}

async function recordRecoveredRevenue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  organizationId: string,
  branchId: string,
  amount: number,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // Atomic increment via RPC — evita la race del read-modify-write cuando se
  // llenan varios slots a la vez. Solo toca estimated_revenue_recovered, nunca
  // pisa los otros contadores de la fila (branch_id, date).
  const { error: rpcErr } = await sb.rpc('increment_recovered_revenue', {
    p_org:    organizationId,
    p_branch: branchId,
    p_date:   today,
    p_amount: amount,
  })
  if (!rpcErr) return

  // Fallback (p. ej. RPC aún no desplegada): read-modify-write.
  const { data: existing } = await sb
    .from('metrics_daily')
    .select('id, estimated_revenue_recovered')
    .eq('branch_id', branchId)
    .eq('date', today)
    .maybeSingle()

  if (existing) {
    const current = Number(existing.estimated_revenue_recovered ?? 0)
    await sb
      .from('metrics_daily')
      .update({ estimated_revenue_recovered: current + amount })
      .eq('id', existing.id)
  } else {
    await sb
      .from('metrics_daily')
      .insert({
        organization_id: organizationId,
        branch_id:       branchId,
        date:            today,
        estimated_revenue_recovered: amount,
      })
  }
}

export async function expireSlot(slotId: string, organizationId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createAdminClient() as any)
    .from('slot_openings')
    .update({ status: 'expired' })
    .eq('id', slotId)
    .eq('organization_id', organizationId)
}
