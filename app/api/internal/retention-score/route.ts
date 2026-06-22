/**
 * GET /api/internal/retention-score
 *
 * Runs weekly (Sunday at 2 AM America/Lima / 07:00 UTC).
 * For every active org:
 *   1. Recalculates retention score for all non-deleted patients
 *   2. Writes score + score_updated_at back to patients
 *   3. Creates a copilot task for each patient with score < 40
 *      (skips if an open task with the same patient already exists)
 *
 * Auth: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { buildRetentionStats, calculateRetentionScore } from '@/lib/analytics/retention'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Fetch all active orgs
  const { data: orgs } = await sb
    .from('organizations')
    .select('id')
    .in('subscription_status', ['active', 'trialing'])

  if (!orgs?.length) return NextResponse.json({ ok: true, orgs: 0 })

  let totalUpdated = 0
  let totalTasks   = 0

  for (const org of orgs as { id: string }[]) {
    const { organizationId: _, ...rest } = { organizationId: org.id, ...{} }
    const organizationId = org.id

    // Fetch all active patients for this org
    const { data: patients } = await sb
      .from('patients')
      .select('id, full_name')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .neq('status', 'lead')

    if (!patients?.length) continue

    const patientIds = (patients as { id: string; full_name: string }[]).map(p => p.id)

    // Fetch all appointments for this batch in one query
    const { data: allApts } = await sb
      .from('appointments')
      .select('patient_id, status, scheduled_at')
      .eq('organization_id', organizationId)
      .in('patient_id', patientIds)

    // Group by patient
    const aptMap = new Map<string, { status: string; scheduled_at: string }[]>()
    for (const a of (allApts ?? [])) {
      if (!aptMap.has(a.patient_id)) aptMap.set(a.patient_id, [])
      aptMap.get(a.patient_id)!.push(a)
    }

    // Find which patients already have an open copilot task (to avoid duplicates)
    const { data: openTasks } = await sb
      .from('copilot_tasks')
      .select('patient_id')
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .in('patient_id', patientIds)

    const patientsWithOpenTask = new Set<string>(
      (openTasks ?? []).map((t: { patient_id: string }) => t.patient_id)
    )

    // Fetch first active branch for task creation
    const { data: branch } = await sb
      .from('branches')
      .select('id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    const branchId = branch?.id ?? null

    const now = new Date().toISOString()
    const updates: { id: string; retention_score: number; score_updated_at: string }[] = []
    const newTasks: {
      organization_id: string
      branch_id:       string | null
      patient_id:      string
      title:           string
      description:     string
      priority:        string
    }[] = []

    for (const patient of patients as { id: string; full_name: string }[]) {
      const apts  = aptMap.get(patient.id) ?? []
      const stats = buildRetentionStats(apts)
      const { score, label } = calculateRetentionScore(stats)

      updates.push({ id: patient.id, retention_score: score, score_updated_at: now })

      if (score < 40 && !patientsWithOpenTask.has(patient.id)) {
        const daysSince = stats.daysSinceLastAppointment
        const noShowRate = stats.totalAppointments > 0
          ? Math.round((stats.noShows / stats.totalAppointments) * 100)
          : 0

        newTasks.push({
          organization_id: organizationId,
          branch_id:       branchId,
          patient_id:      patient.id,
          title:           `Retención: contactar a ${patient.full_name} (score ${score})`,
          description:
            `Score de retención: *${score}/100* — ${label}.\n` +
            `Última visita: ${daysSince !== null ? `hace ${daysSince} días` : 'sin registro'}. ` +
            `Inasistencias: ${stats.noShows} (${noShowRate}%). ` +
            `Sugerencia: llamar y ofrecer disponibilidad próxima.`,
          priority: score < 20 ? 'high' : 'medium',
        })
      }
    }

    // Batch-update scores (update one by one since Supabase upsert needs PK)
    // Use chunked updates for performance
    const CHUNK = 50
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK)
      await Promise.all(
        chunk.map(u =>
          sb.from('patients')
            .update({ retention_score: u.retention_score, score_updated_at: u.score_updated_at })
            .eq('id', u.id)
            .eq('organization_id', organizationId)
        )
      )
    }
    totalUpdated += updates.length

    // Batch-insert new tasks
    if (newTasks.length > 0) {
      await sb.from('copilot_tasks').insert(newTasks)
      totalTasks += newTasks.length
    }
  }

  return NextResponse.json({
    ok: true,
    orgs:    orgs.length,
    updated: totalUpdated,
    tasks:   totalTasks,
  })
}
