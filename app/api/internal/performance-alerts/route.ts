/**
 * GET /api/internal/performance-alerts
 *
 * Runs every Monday at 9 AM America/Lima (14:00 UTC).
 * Checks key performance indicators for each clinic over the last 7 days.
 * Creates a copilot task if a clinic crosses an alert threshold.
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
  const sb      = createAdminClient() as any
  const clinics = await fetchAllClinicsPerformance('week')

  // We also need raw counts to apply the "minimum activity" guard.
  // fetchAllClinicsPerformance gives fillRate (%), but not slotsOpened count.
  // Re-query that lightweight data:
  const now   = new Date()
  const start = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  type SlotCount    = { clinic_id: string }
  type IntakeCount  = { clinic_id: string; first_response_at: string | null; sla_due_at: string | null }

  const [slotRes, intakeRes] = await Promise.all([
    sb.from('slot_openings')
      .select('clinic_id')
      .gte('created_at', start),
    sb.from('intakes')
      .select('clinic_id, first_response_at, sla_due_at')
      .gte('created_at', start),
  ])

  const slotsByClinic   = new Map<string, number>()
  const intakesByClinic = new Map<string, number>()

  for (const r of (slotRes.data ?? []) as SlotCount[]) {
    slotsByClinic.set(r.clinic_id, (slotsByClinic.get(r.clinic_id) ?? 0) + 1)
  }
  for (const r of (intakeRes.data ?? []) as IntakeCount[]) {
    intakesByClinic.set(r.clinic_id, (intakesByClinic.get(r.clinic_id) ?? 0) + 1)
  }

  let alertsFired = 0

  for (const clinic of clinics) {
    const alerts: string[] = []
    const slotsOpened = slotsByClinic.get(clinic.clinicId) ?? 0
    const intakesTotal = intakesByClinic.get(clinic.clinicId) ?? 0

    if (slotsOpened >= 3 && clinic.fillRate < 30) {
      alerts.push(`Fill rate bajo: ${clinic.fillRate}% (${slotsOpened} slots abiertos)`)
    }
    if (intakesTotal >= 5 && clinic.slaMetRate < 50) {
      alerts.push(`SLA bajo: ${clinic.slaMetRate}% de respuestas a tiempo (${intakesTotal} intakes)`)
    }

    if (alerts.length === 0) continue

    // Create a synthetic interaction + copilot task for this clinic
    const { data: interaction } = await sb.from('interactions').insert({
      clinic_id:   clinic.clinicId,
      source_type: 'staff_note',
      raw_content: `[Alerta semanal] ${alerts.join(' · ')}`,
      status:      'done',
    }).select('id').single()

    if (interaction) {
      await sb.from('copilot_tasks').insert({
        interaction_id: interaction.id,
        clinic_id:      clinic.clinicId,
        patient_id:     null,
        title:          `⚠️ Alerta de rendimiento semanal`,
        description:    alerts.join('\n'),
        priority:       'high',
      })
      alertsFired++
    }

    // Log to workflow_runs
    await sb.from('workflow_runs').insert({
      clinic_id:    clinic.clinicId,
      event_type:   'performance_alert',
      entity_type:  'clinic',
      entity_id:    clinic.clinicId,
      status:       'success',
      payload:      { alerts, fillRate: clinic.fillRate, slaMetRate: clinic.slaMetRate },
      completed_at: now.toISOString(),
    }).then(() => {}).catch(() => {})
  }

  return NextResponse.json({
    ok:          true,
    clinicsChecked: clinics.length,
    alertsFired,
    ranAt:       now.toISOString(),
  })
}
