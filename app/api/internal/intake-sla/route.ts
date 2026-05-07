/**
 * GET /api/internal/intake-sla
 *
 * Runs every hour. Checks two things:
 *  1. SLA breaches: intakes with sla_due_at < NOW() and escalation_level = 0
 *     → escalates to level 1, bumps priority to high, creates copilot task
 *  2. Follow-up overdue: intakes waiting_customer with follow_up_due_at < NOW()
 *     → moves to waiting_staff so staff sees it needs attention
 *
 * Auth: same as task-automation — Bearer CRON_SECRET or ?key=ADMIN_DASHBOARD_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const now = new Date().toISOString()

  // ── 1. Escalate overdue SLAs ──────────────────────────────
  const { data: overdueSla } = await sb
    .from('intakes')
    .select('id, clinic_id, contact_name, normalized_summary, escalation_level')
    .in('status', ['new', 'in_progress', 'waiting_staff'])
    .lt('sla_due_at', now)
    .eq('escalation_level', 0)
    .limit(50)

  let escalated = 0
  for (const intake of (overdueSla ?? [])) {
    // Escalate
    await sb.from('intakes').update({
      escalation_level: 1,
      priority:         'high',
    }).eq('id', intake.id)

    // Create a copilot task so the escalation is visible in the operations panel
    const summary = intake.normalized_summary ?? `Intake sin respuesta — ${intake.contact_name ?? 'contacto desconocido'}`
    const { data: interaction } = await sb.from('interactions').insert({
      clinic_id:   intake.clinic_id,
      source_type: 'staff_note',
      raw_content: `[ESCALADO] SLA vencido para intake ${intake.id}. ${summary}`,
      status:      'done',
    }).select('id').single()

    if (interaction) {
      await sb.from('copilot_tasks').insert({
        interaction_id: interaction.id,
        clinic_id:      intake.clinic_id,
        patient_id:     null,
        title:          `ESCALADO: responder a ${intake.contact_name ?? 'contacto'} — SLA vencido`,
        description:    summary,
        priority:       'high',
      })
    }

    // Audit log
    await sb.from('intake_events').insert({
      intake_id:  intake.id,
      clinic_id:  intake.clinic_id,
      event_type: 'escalated',
      actor:      'system',
      details:    { escalation_level: 1, reason: 'sla_breach' },
    }).then(() => {}).catch(() => {})

    escalated++
  }

  // ── 2. Follow-up overdue → waiting_staff ─────────────────
  const { data: overdueFollowup } = await sb
    .from('intakes')
    .select('id, clinic_id')
    .eq('status', 'waiting_customer')
    .lt('follow_up_due_at', now)
    .limit(100)

  const followedUp = overdueFollowup?.length ?? 0
  if (followedUp > 0) {
    const ids = (overdueFollowup ?? []).map((r: { id: string }) => r.id)
    await sb.from('intakes').update({ status: 'waiting_staff' }).in('id', ids)

    // Batch audit log
    const eventRows = (overdueFollowup ?? []).map((r: { id: string; clinic_id: string }) => ({
      intake_id: r.id, clinic_id: r.clinic_id,
      event_type: 'followup_triggered', actor: 'system',
      details: { reason: 'follow_up_due_expired' },
    }))
    if (eventRows.length > 0) {
      await sb.from('intake_events').insert(eventRows).then(() => {}).catch(() => {})
    }
  }

  return NextResponse.json({
    ok:          true,
    escalated,
    followedUp,
    ranAt:       now,
  })
}
