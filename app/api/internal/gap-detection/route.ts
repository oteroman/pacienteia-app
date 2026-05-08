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

  // Resolve org list
  const orgParam = req.nextUrl.searchParams.get('clinic_id') ?? req.nextUrl.searchParams.get('org_id')
  let orgIds: string[]

  if (orgParam) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const field = uuidPattern.test(orgParam) ? 'id' : 'slug'
    const { data: org } = await sb.from('organizations').select('id').eq(field, orgParam).single()
    if (!org) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })
    orgIds = [org.id as string]
  } else {
    const { data: orgs } = await sb.from('organizations').select('id')
    orgIds = ((orgs ?? []) as { id: string }[]).map((o) => o.id)
  }

  // Run detection for each org (sequential to avoid DB overload)
  const results = []
  for (const orgId of orgIds) {
    const result = await detectGapsForClinic(orgId)
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
    orgs:     orgIds.length,
    ...totals,
    ranAt:    new Date().toISOString(),
    details:  results,
  })
}
