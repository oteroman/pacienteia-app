import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export type RebookTrigger = 'cancelled' | 'no_show' | 'no_response' | 'reschedule_request'
export type RebookOutcome = 'pending' | 'rebooked' | 'lost' | 'escalated' | 'no_response'
export type RebookChannel = 'whatsapp' | 'task' | 'internal'

export interface RebookingRecord {
  id:                string
  organizationId:    string
  appointmentId:     string
  patientId:         string | null
  triggerType:       RebookTrigger
  previousStatus:    string
  rebookReason:      string | null
  channel:           RebookChannel
  outcome:           RebookOutcome
  staffTaskId:       string | null
  newAppointmentId:  string | null
  whatsappMessage:   string | null
  patientResponse:   string | null
  resolvedAt:        string | null
  notes:             string | null
  createdAt:         string
  // Joined via query
  patientName?:      string | null
  patientPhone?:     string | null
  treatmentType?:    string
  scheduledAt?:      string
}

export interface FreedSlot {
  appointmentId:  string
  treatmentType:  string
  scheduledAt:    string
  patientName:    string | null
}

export interface RebookingDashboard {
  stats: {
    pending:    number
    rebooked:   number
    escalated:  number
    noResponse: number
    lost:       number
  }
  cancelled:     RebookingRecord[]
  noResponse:    RebookingRecord[]
  slotsFreed:    FreedSlot[]
  resolvedToday: RebookingRecord[]
}

// ── WhatsApp message template ─────────────────────────────────
export function buildRebookMessage(
  patientName:   string,
  treatmentType: string,
  scheduledAt:   string,
): string {
  const date = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(scheduledAt))

  return (
    `Hola ${patientName} 👋 Notamos que tu cita de *${treatmentType}* ` +
    `del ${date} no quedó confirmada.\n\n` +
    `¿Te gustaría reagendarla? Cuéntanos tu disponibilidad y te ayudamos a encontrar un horario que te acomode 😊`
  )
}

// ── Core trigger function (called from webhooks + cron) ───────
export interface TriggerRebookingInput {
  organizationId: string
  branchId?:      string
  appointmentId:  string
  patientId:      string | null
  patientName:    string
  patientPhone:   string | null
  treatmentType: string
  scheduledAt:   string
  triggerType:   RebookTrigger
  previousStatus: string
  rebookReason?: string
}

export async function triggerRebooking(input: TriggerRebookingInput): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const whatsappMessage = buildRebookMessage(input.patientName, input.treatmentType, input.scheduledAt)

  const taskTitle = input.triggerType === 'no_response'
    ? `Sin respuesta: contactar a ${input.patientName} — ${input.treatmentType}`
    : `Reagendar: ${input.patientName} — ${input.treatmentType}`

  let staffTaskId: string | null = null
  if (input.branchId) {
    const { data: task } = await sb.from('copilot_tasks').insert({
      organization_id: input.organizationId,
      branch_id:       input.branchId,
      patient_id:      input.patientId,
      title:           taskTitle,
      description:     `Motivo: ${input.rebookReason ?? input.triggerType}. Teléfono: ${input.patientPhone ?? 'no registrado'}`,
      priority:        'medium',
    }).select('id').single()
    staffTaskId = task?.id ?? null
  }

  const { data: record, error } = await sb.from('appointment_rebooking').insert({
    organization_id: input.organizationId,
    appointment_id:  input.appointmentId,
    patient_id:      input.patientId,
    trigger_type:    input.triggerType,
    previous_status: input.previousStatus,
    rebook_reason:   input.rebookReason ?? null,
    channel:         input.patientPhone ? 'whatsapp' : 'task',
    outcome:         'pending',
    staff_task_id:   staffTaskId,
    whatsapp_message: whatsappMessage,
  }).select('id').single()

  if (error) {
    // Unique constraint violation = already a pending rebooking for this appointment
    if (error.code === '23505') return null
    console.error('[triggerRebooking]', error.message)
    return null
  }

  return record?.id as string | null
}

// ── Dashboard query ───────────────────────────────────────────
export async function fetchRebookingDashboard(clinicId: string): Promise<RebookingDashboard> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = createAdminClient() as any
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const selectRebooking = `
    id, organization_id, appointment_id, patient_id, trigger_type, previous_status,
    rebook_reason, channel, outcome, staff_task_id, new_appointment_id,
    whatsapp_message, patient_response, resolved_at, notes, created_at,
    appointments ( scheduled_at, treatment_type ),
    patients ( full_name, phone )
  `

  const [allPending, resolved, freed] = await Promise.all([
    sb.from('appointment_rebooking')
      .select(selectRebooking)
      .eq('organization_id', clinicId)
      .eq('outcome', 'pending')
      .order('created_at', { ascending: false })
      .limit(50),

    sb.from('appointment_rebooking')
      .select(selectRebooking)
      .eq('organization_id', clinicId)
      .neq('outcome', 'pending')
      .gte('resolved_at', todayStart)
      .order('resolved_at', { ascending: false })
      .limit(20),

    // Slots freed: appointments cancelled today, no rebooking yet resolved
    sb.from('appointments')
      .select('id, scheduled_at, treatment_type, patients ( full_name )')
      .eq('organization_id', clinicId)
      .eq('status', 'cancelled')
      .gte('updated_at', todayStart)
      .gte('scheduled_at', now.toISOString())  // still upcoming
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: true })
      .limit(20),
  ])

  type RawRow = {
    id: string; organization_id: string; appointment_id: string; patient_id: string | null
    trigger_type: string; previous_status: string; rebook_reason: string | null
    channel: string; outcome: string; staff_task_id: string | null
    new_appointment_id: string | null; whatsapp_message: string | null
    patient_response: string | null; resolved_at: string | null
    notes: string | null; created_at: string
    appointments: { scheduled_at: string; treatment_type: string } | null
    patients: { full_name: string; phone: string | null } | null
  }

  const toRecord = (r: RawRow): RebookingRecord => ({
    id:               r.id,
    organizationId:   r.organization_id,
    appointmentId:    r.appointment_id,
    patientId:        r.patient_id,
    triggerType:      r.trigger_type as RebookTrigger,
    previousStatus:   r.previous_status,
    rebookReason:     r.rebook_reason,
    channel:          r.channel as RebookChannel,
    outcome:          r.outcome as RebookOutcome,
    staffTaskId:      r.staff_task_id,
    newAppointmentId: r.new_appointment_id,
    whatsappMessage:  r.whatsapp_message,
    patientResponse:  r.patient_response,
    resolvedAt:       r.resolved_at,
    notes:            r.notes,
    createdAt:        r.created_at,
    patientName:      r.patients?.full_name,
    patientPhone:     r.patients?.phone,
    treatmentType:    r.appointments?.treatment_type,
    scheduledAt:      r.appointments?.scheduled_at,
  })

  const pending = (allPending.data ?? []) as RawRow[]
  const cancelled   = pending.filter((r) => r.trigger_type === 'cancelled' || r.trigger_type === 'reschedule_request')
  const noResponse  = pending.filter((r) => r.trigger_type === 'no_response' || r.trigger_type === 'no_show')

  type SlotRow = {
    id: string; scheduled_at: string; treatment_type: string
    patients: { full_name: string } | null
  }
  const slotsFreed: FreedSlot[] = ((freed.data ?? []) as SlotRow[]).map((r) => ({
    appointmentId: r.id,
    treatmentType: r.treatment_type,
    scheduledAt:   r.scheduled_at,
    patientName:   r.patients?.full_name ?? null,
  }))

  const resolvedRows = (resolved.data ?? []) as RawRow[]

  const allRows = [...pending, ...resolvedRows] as RawRow[]
  const stats = {
    pending:    allRows.filter((r) => r.outcome === 'pending').length,
    rebooked:   allRows.filter((r) => r.outcome === 'rebooked').length,
    escalated:  allRows.filter((r) => r.outcome === 'escalated').length,
    noResponse: allRows.filter((r) => r.outcome === 'no_response').length,
    lost:       allRows.filter((r) => r.outcome === 'lost').length,
  }

  return {
    stats,
    cancelled:     cancelled.map(toRecord),
    noResponse:    noResponse.map(toRecord),
    slotsFreed,
    resolvedToday: resolvedRows.map(toRecord),
  }
}

export async function resolveRebooking(
  rebookingId: string,
  clinicId:    string,
  outcome:     Exclude<RebookOutcome, 'pending'>,
  notes?:      string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createAdminClient() as any)
    .from('appointment_rebooking')
    .update({ outcome, notes: notes ?? null, resolved_at: new Date().toISOString() })
    .eq('id', rebookingId)
    .eq('organization_id', clinicId)
}
