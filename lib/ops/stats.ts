import { createAdminClient } from '@/lib/supabase/admin'
import type { IntakeChannel, IntakeStatus } from '@/lib/intake/index'

// ── Stats DTO ─────────────────────────────────────────────────
export interface OpsStats {
  // Live pipeline
  intakesNew:        number
  intakesInProgress: number
  intakesWaiting:    number   // waiting_customer + waiting_staff
  escalationsActive: number
  followUpsDue:      number   // follow_up_due_at <= NOW()
  tasksOpen:         number
  // Today
  intakesToday:      number
  resolvedToday:     number
}

export interface EscalatedIntake {
  id:               string
  contactName:      string | null
  sourceChannel:    IntakeChannel
  escalationLevel:  number
  normalizedSummary: string | null
  slaDueAt:         string | null
  createdAt:        string
}

export interface FollowUpItem {
  id:               string
  contactName:      string | null
  sourceChannel:    IntakeChannel
  status:           IntakeStatus
  normalizedSummary: string | null
  followUpDueAt:    string
}

export interface IntakeEvent {
  id:        string
  intakeId:  string
  eventType: string
  actor:     string
  details:   Record<string, unknown>
  createdAt: string
}

// ── Queries ───────────────────────────────────────────────────
export async function fetchOpsStats(clinicId: string): Promise<OpsStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = createAdminClient() as any
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    statusCounts,
    escalations,
    followUps,
    tasks,
    todayIntakes,
    resolvedToday,
  ] = await Promise.all([
    sb.from('intakes').select('status').eq('clinic_id', clinicId)
      .in('status', ['new', 'in_progress', 'waiting_customer', 'waiting_staff']),
    sb.from('intakes').select('id').eq('clinic_id', clinicId)
      .gt('escalation_level', 0)
      .not('status', 'in', '(resolved,dismissed)'),
    sb.from('intakes').select('id').eq('clinic_id', clinicId)
      .eq('status', 'waiting_customer')
      .lte('follow_up_due_at', now.toISOString()),
    sb.from('copilot_tasks').select('id').eq('clinic_id', clinicId).eq('status', 'open'),
    sb.from('intakes').select('id').eq('clinic_id', clinicId)
      .gte('created_at', todayStart),
    sb.from('intakes').select('id').eq('clinic_id', clinicId)
      .eq('status', 'resolved')
      .gte('resolved_at', todayStart),
  ])

  const rows = (statusCounts.data ?? []) as { status: string }[]
  return {
    intakesNew:        rows.filter((r) => r.status === 'new').length,
    intakesInProgress: rows.filter((r) => r.status === 'in_progress').length,
    intakesWaiting:    rows.filter((r) => r.status === 'waiting_customer' || r.status === 'waiting_staff').length,
    escalationsActive: (escalations.data ?? []).length,
    followUpsDue:      (followUps.data    ?? []).length,
    tasksOpen:         (tasks.data        ?? []).length,
    intakesToday:      (todayIntakes.data  ?? []).length,
    resolvedToday:     (resolvedToday.data ?? []).length,
  }
}

export async function fetchEscalations(clinicId: string): Promise<EscalatedIntake[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data } = await sb
    .from('intakes')
    .select('id, contact_name, source_channel, escalation_level, normalized_summary, sla_due_at, created_at')
    .eq('clinic_id', clinicId)
    .gt('escalation_level', 0)
    .not('status', 'in', '(resolved,dismissed)')
    .order('escalation_level', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(20)

  return ((data ?? []) as {
    id: string; contact_name: string | null; source_channel: string
    escalation_level: number; normalized_summary: string | null
    sla_due_at: string | null; created_at: string
  }[]).map((r) => ({
    id:               r.id,
    contactName:      r.contact_name,
    sourceChannel:    r.source_channel as IntakeChannel,
    escalationLevel:  r.escalation_level,
    normalizedSummary: r.normalized_summary,
    slaDueAt:         r.sla_due_at,
    createdAt:        r.created_at,
  }))
}

export async function fetchFollowUpsDue(clinicId: string): Promise<FollowUpItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = createAdminClient() as any
  const now = new Date().toISOString()

  const { data } = await sb
    .from('intakes')
    .select('id, contact_name, source_channel, status, normalized_summary, follow_up_due_at')
    .eq('clinic_id', clinicId)
    .in('status', ['waiting_customer', 'waiting_staff'])
    .lte('follow_up_due_at', now)
    .order('follow_up_due_at', { ascending: true })
    .limit(20)

  return ((data ?? []) as {
    id: string; contact_name: string | null; source_channel: string
    status: string; normalized_summary: string | null; follow_up_due_at: string
  }[]).map((r) => ({
    id:               r.id,
    contactName:      r.contact_name,
    sourceChannel:    r.source_channel as IntakeChannel,
    status:           r.status as IntakeStatus,
    normalizedSummary: r.normalized_summary,
    followUpDueAt:    r.follow_up_due_at,
  }))
}

export async function fetchRecentEvents(clinicId: string, limit = 30): Promise<IntakeEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data } = await sb
    .from('intake_events')
    .select('id, intake_id, event_type, actor, details, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as {
    id: string; intake_id: string; event_type: string
    actor: string; details: Record<string, unknown>; created_at: string
  }[]).map((r) => ({
    id:        r.id,
    intakeId:  r.intake_id,
    eventType: r.event_type,
    actor:     r.actor,
    details:   r.details,
    createdAt: r.created_at,
  }))
}
