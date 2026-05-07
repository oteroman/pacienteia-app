/**
 * GET /api/internal/gap-detection
 *
 * Runs daily at 9 AM America/Lima (14:00 UTC).
 * Scans each clinic's next 7 days of appointments.
 * Days with fewer than 60% of the clinic's 30-day average → gap detected.
 * For each new gap day, calls triggerBackfill() to create a slot_opening + copilot task.
 *
 * Idempotent: skips gap days that already have an open slot_opening.
 *
 * Auth: Bearer CRON_SECRET or ?key=ADMIN_DASHBOARD_SECRET
 * Optional query param: clinic_id (UUID or slug) — process one clinic only
 */

import { NextRequest, NextResponse }    from 'next/server'
import { createAdminClient }            from '@/lib/supabase/admin'
import { detectGapsForClinic }          from '@/lib/backfill/gap-detection'

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

  // Resolve clinic list
  const clinicParam = req.nextUrl.searchParams.get('clinic_id')
  let clinicIds: string[]

  if (clinicParam) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const field = uuidPattern.test(clinicParam) ? 'id' : 'slug'
    const { data: clinic } = await sb.from('clinics').select('id').eq(field, clinicParam).single()
    if (!clinic) return NextResponse.json({ error: 'clinic_not_found' }, { status: 404 })
    clinicIds = [clinic.id as string]
  } else {
    const { data: clinics } = await sb.from('clinics').select('id')
    clinicIds = ((clinics ?? []) as { id: string }[]).map((c) => c.id)
  }

  // Run detection for each clinic (sequential to avoid DB overload)
  const results = []
  for (const clinicId of clinicIds) {
    const result = await detectGapsForClinic(clinicId)
    results.push(result)
  }

  const totals = results.reduce(
    (acc, r) => ({
      gapsFound: acc.gapsFound + r.gapsFound,
      triggered: acc.triggered + r.triggered,
      skipped:   acc.skipped   + r.skipped,
    }),
    { gapsFound: 0, triggered: 0, skipped: 0 },
  )

  return NextResponse.json({
    ok:       true,
    clinics:  clinicIds.length,
    ...totals,
    ranAt:    new Date().toISOString(),
    details:  results,
  })
}
