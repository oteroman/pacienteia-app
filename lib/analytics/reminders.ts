import { createAdminClient } from '@/lib/supabase/admin'

export type ReminderPeriod = '7d' | '30d' | '90d'

export type ReminderStats = {
  period: { label: string; start: string; end: string }
  // 24h reminder funnel (these have the 1/2 response mechanic)
  r24Total: number
  r24Confirmed: number
  r24Rescheduled: number
  r24NoResponse: number
  r24Failed: number
  confirmationRate: number       // confirmed / (total - failed)
  // 2h reminders
  r2Total: number
  // Appointment outcomes for appts scheduled in the same period
  apptsTotal: number
  apptsCompleted: number
  apptsNoShow: number
  apptsCancelled: number
  noShowRate: number
  // Recent rows for the table
  recent: ReminderRow[]
}

export type ReminderRow = {
  id: string
  patientName: string
  scheduledAt: string
  treatmentType: string | null
  reminderType: '24h' | '2h'
  reminderStatus: 'sent' | 'confirmed' | 'reschedule_requested' | 'failed'
  appointmentStatus: string
  sentAt: string
  respondedAt: string | null
}

function periodWindow(p: ReminderPeriod): { start: string; end: string; label: string } {
  const now = new Date()
  const days = p === '7d' ? 7 : p === '30d' ? 30 : 90
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    start: start.toISOString(),
    end:   now.toISOString(),
    label: p === '7d' ? 'Últimos 7 días' : p === '30d' ? 'Últimos 30 días' : 'Últimos 90 días',
  }
}

export async function fetchReminderStats(
  organizationId: string,
  branchId: string | null,
  period: ReminderPeriod = '30d',
): Promise<ReminderStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { start, end, label } = periodWindow(period)

  const baseReminders = sb
    .from('appointment_reminders')
    .select('reminder_type, status')
    .eq('organization_id', organizationId)
    .gte('sent_at', start)
    .lt('sent_at', end)

  const baseAppts = sb
    .from('appointments')
    .select('status')
    .eq('organization_id', organizationId)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .is('deleted_at', null)

  const baseRecent = sb
    .from('appointment_reminders')
    .select('id, reminder_type, status, sent_at, responded_at, patients(full_name), appointments(status, scheduled_at, treatment_type)')
    .eq('organization_id', organizationId)
    .gte('sent_at', start)
    .lt('sent_at', end)
    .order('sent_at', { ascending: false })
    .limit(25)

  if (branchId) {
    baseReminders.eq('branch_id', branchId)
    baseAppts.eq('branch_id', branchId)
    baseRecent.eq('branch_id', branchId)
  }

  const [{ data: rRows }, { data: aRows }, { data: recentRows }] = await Promise.all([
    baseReminders,
    baseAppts,
    baseRecent,
  ])

  // ── Reminder funnel ─────────────────────────────────────────────
  type RRow = { reminder_type: string; status: string }
  const reminders = (rRows ?? []) as RRow[]

  const r24 = reminders.filter((r) => r.reminder_type === '24h')
  const r24Total      = r24.length
  const r24Confirmed  = r24.filter((r) => r.status === 'confirmed').length
  const r24Rescheduled = r24.filter((r) => r.status === 'reschedule_requested').length
  const r24Failed     = r24.filter((r) => r.status === 'failed').length
  const r24NoResponse = r24Total - r24Confirmed - r24Rescheduled - r24Failed
  const r24Active     = r24Total - r24Failed
  const confirmationRate = r24Active > 0 ? Math.round((r24Confirmed / r24Active) * 100) : 0

  const r2Total = reminders.filter((r) => r.reminder_type === '2h').length

  // ── Appointment outcomes ────────────────────────────────────────
  type ARow = { status: string }
  const appts       = (aRows ?? []) as ARow[]
  const apptsTotal  = appts.length
  const apptsCompleted = appts.filter((a) => a.status === 'completed').length
  const apptsNoShow    = appts.filter((a) => a.status === 'no_show').length
  const apptsCancelled = appts.filter((a) => a.status === 'cancelled').length
  const noShowRate  = apptsTotal > 0 ? Math.round((apptsNoShow / apptsTotal) * 100) : 0

  // ── Recent rows ─────────────────────────────────────────────────
  type RecentRaw = {
    id: string; reminder_type: string; status: string
    sent_at: string; responded_at: string | null
    patients: { full_name: string } | null
    appointments: { status: string; scheduled_at: string; treatment_type: string | null } | null
  }
  const recent: ReminderRow[] = ((recentRows ?? []) as RecentRaw[]).map((r) => ({
    id:                r.id,
    patientName:       r.patients?.full_name ?? 'Paciente',
    scheduledAt:       r.appointments?.scheduled_at ?? '',
    treatmentType:     r.appointments?.treatment_type ?? null,
    reminderType:      r.reminder_type as '24h' | '2h',
    reminderStatus:    r.status as ReminderRow['reminderStatus'],
    appointmentStatus: r.appointments?.status ?? '',
    sentAt:            r.sent_at,
    respondedAt:       r.responded_at,
  }))

  return {
    period: { label, start, end },
    r24Total, r24Confirmed, r24Rescheduled, r24NoResponse, r24Failed,
    confirmationRate,
    r2Total,
    apptsTotal, apptsCompleted, apptsNoShow, apptsCancelled,
    noShowRate,
    recent,
  }
}
