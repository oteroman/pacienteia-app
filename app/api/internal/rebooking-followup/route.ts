/**
 * GET /api/internal/rebooking-followup
 *
 * Runs daily at 4 PM America/Lima (21:00 UTC).
 * Finds appointments for TOMORROW that are still 'scheduled' —
 * meaning the 8 AM reminder was sent but the patient never replied.
 * Creates a rebooking record + copilot task for each.
 *
 * Auth: Bearer CRON_SECRET or ?key=ADMIN_DASHBOARD_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { triggerRebooking }          from '@/lib/rebooking/index'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

// Returns [tomorrowStart, tomorrowEnd] in UTC for Lima timezone
function tomorrowLimaRange(): [string, string] {
  const now  = new Date()
  // Lima is UTC-5; midnight Lima = 05:00 UTC
  const limaDate = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  limaDate.setUTCHours(0, 0, 0, 0)
  limaDate.setUTCDate(limaDate.getUTCDate() + 1) // move to tomorrow Lima midnight
  const startUTC = new Date(limaDate.getTime() + 5 * 60 * 60 * 1000)
  const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
  return [startUTC.toISOString(), endUTC.toISOString()]
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const [start, end] = tomorrowLimaRange()

  // Find all tomorrow-scheduled appointments still in 'scheduled' status (not confirmed, not cancelled)
  const { data: rows, error } = await sb
    .from('appointments')
    .select('id, organization_id, patient_id, treatment_type, scheduled_at, patients ( full_name, phone )')
    .eq('status', 'scheduled')
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .is('deleted_at', null)
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type ApptRow = {
    id: string; organization_id: string; patient_id: string | null
    treatment_type: string; scheduled_at: string
    patients: { full_name: string; phone: string | null } | null
  }

  let triggered = 0
  let skipped   = 0

  for (const appt of (rows as ApptRow[])) {
    const result = await triggerRebooking({
      organizationId: appt.organization_id,
      appointmentId:  appt.id,
      patientId:      appt.patient_id,
      patientName:    appt.patients?.full_name ?? 'Paciente',
      patientPhone:   appt.patients?.phone     ?? null,
      treatmentType:  appt.treatment_type,
      scheduledAt:    appt.scheduled_at,
      triggerType:    'no_response',
      previousStatus: 'scheduled',
      rebookReason:   'Sin respuesta al recordatorio del día anterior',
    })

    if (result) triggered++
    else        skipped++  // already has a pending rebooking
  }

  return NextResponse.json({ ok: true, triggered, skipped, ranAt: new Date().toISOString() })
}
