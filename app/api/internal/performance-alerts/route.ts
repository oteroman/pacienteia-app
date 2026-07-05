/**
 * GET /api/internal/performance-alerts
 *
 * Runs every Monday at 9 AM America/Lima (14:00 UTC).
 * Checks key performance indicators for each org over the last 7 days.
 * Creates a copilot task if an org crosses an alert threshold.
 *
 * Thresholds (only fires when there is enough activity to be meaningful):
 *   fill_rate  < 30%  with ≥ 3 slots opened
 *   sla_met    < 50%  with ≥ 5 intakes
 *
 * Auth: Bearer CRON_SECRET or ?key=ADMIN_DASHBOARD_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { fetchAllClinicsPerformance } from '@/lib/analytics/revenue'

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
  const sb    = createAdminClient() as any
  const orgs  = await fetchAllClinicsPerformance('week')

  const now   = new Date()
  const start = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  type SlotCount   = { organization_id: string }
  type IntakeCount = { organization_id: string; first_response_at: string | null; sla_due_at: string | null }

  const [slotRes, intakeRes] = await Promise.all([
    sb.from('slot_openings')
      .select('organization_id')
      .gte('created_at', start),
    sb.from('intakes')
      .select('organization_id, first_response_at, sla_due_at')
      .gte('created_at', start),
  ])

  const slotsByOrg   = new Map<string, number>()
  const intakesByOrg = new Map<string, number>()

  for (const r of (slotRes.data ?? []) as SlotCount[]) {
    slotsByOrg.set(r.organization_id, (slotsByOrg.get(r.organization_id) ?? 0) + 1)
  }
  for (const r of (intakeRes.data ?? []) as IntakeCount[]) {
    intakesByOrg.set(r.organization_id, (intakesByOrg.get(r.organization_id) ?? 0) + 1)
  }

  let alertsFired = 0

  for (const org of orgs) {
    const alerts: string[] = []
    const slotsOpened  = slotsByOrg.get(org.clinicId) ?? 0
    const intakesTotal = intakesByOrg.get(org.clinicId) ?? 0

    if (slotsOpened >= 3 && org.fillRate < 30) {
      alerts.push(`Fill rate bajo: ${org.fillRate}% (${slotsOpened} slots abiertos)`)
    }
    if (intakesTotal >= 5 && org.slaMetRate < 50) {
      alerts.push(`SLA bajo: ${org.slaMetRate}% de respuestas a tiempo (${intakesTotal} intakes)`)
    }

    if (alerts.length === 0) continue

    const { data: interaction } = await sb.from('interactions').insert({
      organization_id: org.clinicId,
      source_type:     'staff_note',
      raw_content:     `[Alerta semanal] ${alerts.join(' · ')}`,
      status:          'done',
    }).select('id').single()

    if (interaction) {
      await sb.from('copilot_tasks').insert({
        interaction_id:  interaction.id,
        organization_id: org.clinicId,
        patient_id:      null,
        title:           `⚠️ Alerta de rendimiento semanal`,
        description:     alerts.join('\n'),
        priority:        'high',
      })
      alertsFired++
    }
  }

  return NextResponse.json({
    ok:             true,
    orgsChecked:    orgs.length,
    alertsFired,
    ranAt:          now.toISOString(),
  })
}
