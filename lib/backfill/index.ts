import { createAdminClient } from '@/lib/supabase/admin'

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
  clinicId:          string
  appointmentId:     string | null
  treatmentType:     string
  slotStart:         string
  slotEnd:           string | null
  reasonOpened:      SlotReason
  status:            SlotStatus
  candidates:        Candidate[]
  candidateCount:    number
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
    open:       number
    filledToday: number
    fillRate:   number   // 0-100 over last 30 days
    totalSlots: number
  }
  openSlots:    SlotOpening[]
  filledToday:  SlotOpening[]
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
    `¿Te gustaría tomar este espacio? Responde *SÍ* para confirmarte o escríbenos si tienes alguna duda 😊`
  )
}

// ── Candidate scoring ─────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  clinicId:      string,
  treatmentType: string,
  slotStart:     string,
  limit = 5,
): Promise<Candidate[]> {
  const now           = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const oneYearAgo    = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const isUrgent      = new Date(slotStart).getTime() - now.getTime() < 48 * 60 * 60 * 1000

  // Accumulator: patientId → Candidate (partial)
  const map = new Map<string, Omit<Candidate, 'waMessage'>>()

  // ── Source 1: past appointments with same treatment ────────
  const { data: histRows } = await sb
    .from('appointments')
    .select('patient_id, scheduled_at, patients ( id, full_name, phone, on_waitlist )')
    .eq('clinic_id', clinicId)
    .eq('treatment_type', treatmentType)
    .in('status', ['completed', 'confirmed'])
    .gte('scheduled_at', oneYearAgo)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: false })
    .limit(60)

  for (const row of (histRows ?? [])) {
    const p = row.patients
    if (!p?.phone) continue
    const id = p.id as string
    if (map.has(id)) continue            // already added; score bonus via source 2/3

    const isRecent   = new Date(row.scheduled_at) >= new Date(ninetyDaysAgo)
    const reasons: string[] = ['Mismo tratamiento previo']
    let score = 30
    if (isRecent)   { score += 15; reasons.push('Visita reciente (<90 días)') }
    if (p.on_waitlist) { score += 10; reasons.push('En lista de espera') }
    if (isUrgent)   { score += 5;  reasons.push('Slot urgente') }

    map.set(id, { patientId: id, patientName: p.full_name, phone: p.phone, score, scoreReasons: reasons, isWaitlisted: !!p.on_waitlist })
  }

  // ── Source 2: pending rebooking for same treatment ─────────
  const { data: reRows } = await sb
    .from('appointment_rebooking')
    .select('patient_id, patients ( id, full_name, phone, on_waitlist ), appointments ( treatment_type )')
    .eq('clinic_id', clinicId)
    .eq('outcome', 'pending')
    .not('patient_id', 'is', null)
    .limit(30)

  for (const row of (reRows ?? [])) {
    if (row.appointments?.treatment_type !== treatmentType) continue
    const p = row.patients
    if (!p?.phone) continue
    const id = p.id as string

    if (map.has(id)) {
      const c = map.get(id)!
      c.score += 20
      c.scoreReasons.push('Quiere reagendar este tratamiento')
    } else {
      const reasons = ['Quiere reagendar este tratamiento']
      let score = 20
      if (p.on_waitlist) { score += 10; reasons.push('En lista de espera') }
      if (isUrgent)      { score += 5;  reasons.push('Slot urgente') }
      map.set(id, { patientId: id, patientName: p.full_name, phone: p.phone, score, scoreReasons: reasons, isWaitlisted: !!p.on_waitlist })
    }
  }

  // ── Source 3: open appointment_request intakes ─────────────
  const { data: inRows } = await sb
    .from('intakes')
    .select('patient_id')
    .eq('clinic_id', clinicId)
    .eq('detected_intent', 'appointment_request')
    .in('status', ['new', 'in_progress'])
    .not('patient_id', 'is', null)
    .limit(30)

  const intakePatientIds = new Set<string>(
    (inRows ?? []).map((r: { patient_id: string }) => r.patient_id).filter(Boolean),
  )

  for (const [id, c] of map.entries()) {
    if (intakePatientIds.has(id)) {
      c.score += 15
      c.scoreReasons.push('Solicitud de cita abierta')
    }
  }

  // ── Rank, cap at 100, return top N ─────────────────────────
  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => ({
      ...c,
      score:    Math.min(c.score, 100),
      waMessage: buildWaMessage(c.patientName, treatmentType, slotStart),
    }))
}

// ── Core trigger ──────────────────────────────────────────────
export interface TriggerBackfillInput {
  clinicId:      string
  appointmentId: string | null
  treatmentType: string
  slotStart:     string
  slotEnd?:      string
  reasonOpened:  SlotReason
}

export async function triggerBackfill(input: TriggerBackfillInput): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const candidates = await findCandidates(sb, input.clinicId, input.treatmentType, input.slotStart)

  // Create synthetic interaction for copilot task FK
  let staffTaskId: string | null = null
  if (candidates.length > 0) {
    const top = candidates[0]
    const { data: interaction } = await sb.from('interactions').insert({
      clinic_id:   input.clinicId,
      source_type: 'staff_note',
      raw_content: `[Backfill] Slot libre de ${input.treatmentType} — candidato: ${top.patientName}`,
      status:      'done',
    }).select('id').single()

    if (interaction) {
      const { data: task } = await sb.from('copilot_tasks').insert({
        interaction_id: interaction.id,
        clinic_id:      input.clinicId,
        patient_id:     top.patientId,
        title:          `Llenar slot: contactar a ${top.patientName} — ${input.treatmentType}`,
        description:    `Score ${top.score}/100. Tel: ${top.phone}. Razones: ${top.scoreReasons.join(', ')}.`,
        priority:       'medium',
      }).select('id').single()
      staffTaskId = task?.id ?? null
    }
  }

  const { data: record, error } = await sb.from('slot_openings').insert({
    clinic_id:       input.clinicId,
    appointment_id:  input.appointmentId,
    treatment_type:  input.treatmentType,
    slot_start:      input.slotStart,
    slot_end:        input.slotEnd ?? null,
    reason_opened:   input.reasonOpened,
    candidates:      candidates,
    candidate_count: candidates.length,
    staff_task_id:   staffTaskId,
  }).select('id').single()

  if (error) {
    console.error('[triggerBackfill]', error.message)
    return null
  }

  return record?.id as string | null
}

// ── Dashboard query ───────────────────────────────────────────
export async function fetchBackfillDashboard(clinicId: string): Promise<BackfillDashboard> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = createAdminClient() as any
  const now = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const selectSlot = `
    id, clinic_id, appointment_id, treatment_type, slot_start, slot_end,
    reason_opened, status, candidates, candidate_count,
    selected_patient_id, new_appointment_id, fill_attempts,
    staff_task_id, filled_at, notes, created_at
  `

  const [openRes, filledRes, rateRes] = await Promise.all([
    sb.from('slot_openings')
      .select(selectSlot)
      .eq('clinic_id', clinicId)
      .eq('status', 'open')
      .order('slot_start', { ascending: true })
      .limit(30),

    sb.from('slot_openings')
      .select(selectSlot)
      .eq('clinic_id', clinicId)
      .eq('status', 'filled')
      .gte('filled_at', todayStart)
      .order('filled_at', { ascending: false })
      .limit(20),

    sb.from('slot_openings')
      .select('status')
      .eq('clinic_id', clinicId)
      .gte('created_at', thirtyDaysAgo),
  ])

  const toSlot = (r: Record<string, unknown>): SlotOpening => ({
    id:                r.id as string,
    clinicId:          r.clinic_id as string,
    appointmentId:     r.appointment_id as string | null,
    treatmentType:     r.treatment_type as string,
    slotStart:         r.slot_start as string,
    slotEnd:           r.slot_end as string | null,
    reasonOpened:      r.reason_opened as SlotReason,
    status:            r.status as SlotStatus,
    candidates:        (r.candidates as Candidate[]) ?? [],
    candidateCount:    r.candidate_count as number,
    selectedPatientId: r.selected_patient_id as string | null,
    newAppointmentId:  r.new_appointment_id as string | null,
    fillAttempts:      r.fill_attempts as number,
    staffTaskId:       r.staff_task_id as string | null,
    filledAt:          r.filled_at as string | null,
    notes:             r.notes as string | null,
    createdAt:         r.created_at as string,
  })

  const rateRows  = (rateRes.data ?? []) as { status: string }[]
  const totalSlots = rateRows.length
  const filledSlots = rateRows.filter((r) => r.status === 'filled').length
  const fillRate  = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0

  const openSlots   = (openRes.data   ?? []).map(toSlot)
  const filledToday = (filledRes.data ?? []).map(toSlot)

  return {
    stats: {
      open:        openSlots.length,
      filledToday: filledToday.length,
      fillRate,
      totalSlots,
    },
    openSlots,
    filledToday,
  }
}

export async function fillSlot(
  slotId:           string,
  clinicId:         string,
  selectedPatientId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createAdminClient() as any)
    .from('slot_openings')
    .update({
      status:              'filled',
      selected_patient_id: selectedPatientId,
      filled_at:           new Date().toISOString(),
      fill_attempts:       1,
    })
    .eq('id', slotId)
    .eq('clinic_id', clinicId)
}

export async function expireSlot(slotId: string, clinicId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createAdminClient() as any)
    .from('slot_openings')
    .update({ status: 'expired' })
    .eq('id', slotId)
    .eq('clinic_id', clinicId)
}
