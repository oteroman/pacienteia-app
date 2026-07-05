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
    .select('id, organization_id, contact_name, normalized_summary, escalation_level')
    .in('status', ['new', 'in_progress'])
    .lt('sla_due_at', now)
    .eq('escalation_level', 0)
    .limit(50)

  let escalated = 0
  for (const intake of (overdueSla ?? [])) {
    await sb.from('intakes').update({
      escalation_level: 1,
      priority:         'high',
    }).eq('id', intake.id)

    const summary = intake.normalized_summary ?? `Intake sin respuesta — ${intake.contact_name ?? 'contacto desconocido'}`

    await sb.from('copilot_tasks').insert({
      organization_id: intake.organization_id,
      patient_id:      null,
      title:           `ESCALADO: responder a ${intake.contact_name ?? 'contacto'} — SLA vencido`,
      description:     summary,
      priority:        'high',
      status:          'open',
      source:          'sla_breach',
    })

    await sb.from('intake_events').insert({
      intake_id:       intake.id,
      organization_id: intake.organization_id,
      event_type:      'escalated',
      actor:           'system',
      details:         { escalation_level: 1, reason: 'sla_breach' },
    }).then(() => {}).catch(() => {})

    escalated++
  }

  // ── 2. Follow-up overdue → in_progress ───────────────────
  const { data: overdueFollowup } = await sb
    .from('intakes')
    .select('id, organization_id')
    .eq('status', 'in_progress')
    .lt('follow_up_due_at', now)
    .limit(100)

  const followedUp = overdueFollowup?.length ?? 0
  if (followedUp > 0) {
    const ids = (overdueFollowup ?? []).map((r: { id: string }) => r.id)
    await sb.from('intakes').update({ priority: 'high' }).in('id', ids)

    const eventRows = (overdueFollowup ?? []).map((r: { id: string; organization_id: string }) => ({
      intake_id:       r.id,
      organization_id: r.organization_id,
      event_type:      'followup_triggered',
      actor:           'system',
      details:         { reason: 'follow_up_due_expired' },
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
