/**
 * /api/internal/flash-offers
 *
 * POST — Detects empty slots for tomorrow and sends flash offer WhatsApps
 *        to inactive patients (up to 2 per professional per slot).
 *        Idempotent: skips slots already notified today.
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 *
 * Body (JSON):
 *   clinic_id     string  UUID (required)
 *   branch_id     string  UUID (required)
 *   discount_pct  number  default 20
 *   target_date   string  YYYY-MM-DD Lima — default: tomorrow
 */

import { NextRequest, NextResponse }    from 'next/server'
import { sendFlashOffers }             from '@/lib/whatsapp/flash-offers'
import { isAutomationEnabled }         from '@/lib/automation/settings'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const orgId       = body.clinic_id    as string | undefined
  const branchId    = body.branch_id    as string | undefined
  const discountPct = Number(body.discount_pct ?? 20)
  const targetDate  = body.target_date  as string | undefined

  if (!orgId || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }

  if (!(await isAutomationEnabled(orgId, branchId, 'flash_offers'))) {
    return NextResponse.json({ skipped: true, reason: 'automation_disabled' })
  }

  const result = await sendFlashOffers({
    organizationId: orgId,
    branchId,
    discountPct,
    targetDate,
  })

  return NextResponse.json(result)
}
