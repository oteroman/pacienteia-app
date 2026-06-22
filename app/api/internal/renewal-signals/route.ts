/**
 * GET /api/internal/renewal-signals
 *
 * Runs every Monday at 10 AM America/Lima (15:00 UTC).
 * Computes renewal signals for all orgs and creates copilot tasks
 * for orgs in 'renewal_risk' or 'expansion_ready' state.
 *
 * Auth: Bearer CRON_SECRET or ?key=ADMIN_DASHBOARD_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { fetchRenewalSignals }       from '@/lib/analytics/signals'

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
  const sb  = createAdminClient() as any
  const now = new Date()

  const signals = await fetchRenewalSignals('30d')

  const actionable = signals.filter(
    (s) => s.signal === 'renewal_risk' || s.signal === 'expansion_ready',
  )

  let tasksCreated = 0

  for (const s of actionable) {
    const title = s.signal === 'renewal_risk'
      ? `⚠️ Intervención urgente: ${s.clinicName}`
      : `🚀 Propuesta de upgrade: ${s.clinicName}`

    const description = [
      `Señal: ${s.meta.label}`,
      `Motivos: ${s.reasons.join(', ')}`,
      `KPIs: Fill ${s.kpis.fillRate}% · SLA ${s.kpis.slaMetRate}% · Score ${s.kpis.score}/100`,
      `Próximos pasos:`,
      ...s.playbook.map((p) => `${p.step}. ${p.action}`),
    ].join('\n')

    const { data: interaction } = await sb.from('interactions').insert({
      organization_id: s.clinicId,
      source_type:     'staff_note',
      raw_content:     `[Renewal Signal] ${s.signal} — ${s.clinicName}`,
      status:          'done',
    }).select('id').single()

    if (interaction) {
      await sb.from('copilot_tasks').insert({
        interaction_id:  interaction.id,
        organization_id: s.clinicId,
        patient_id:      null,
        title,
        description,
        priority:        s.signal === 'renewal_risk' ? 'high' : 'medium',
      })
      tasksCreated++
    }
  }

  return NextResponse.json({
    ok:           true,
    orgs:         signals.length,
    actionable:   actionable.length,
    tasksCreated,
    breakdown: Object.fromEntries(
      ['renewal_risk','expansion_ready','expansion_low_hanging','healthy_renewal','renewal_watch','inactive']
        .map((k) => [k, signals.filter((s) => s.signal === k).length]),
    ),
    ranAt: now.toISOString(),
  })
}
