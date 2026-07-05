/**
 * GET /api/internal/deposit-expiry
 *
 * No-show blindado: libera cupos cuya separación no se pagó en DEPOSIT_TTL_HOURS
 * y los ofrece a la lista de recuperación. Recomendado cada 15-30 min.
 *
 * Idempotente: una cita liberada pasa a payment_status='expired' y deja de calificar.
 *
 * Auth: Bearer CRON_SECRET o ?key=ADMIN_DASHBOARD_SECRET
 */

import { NextRequest, NextResponse }        from 'next/server'
import { createAdminClient }                from '@/lib/supabase/admin'
import { releaseExpiredDepositsForOrg }     from '@/lib/backfill/deposit-expiry'

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
  const { data: orgs } = await sb.from('organizations').select('id')
  const orgIds = ((orgs ?? []) as { id: string }[]).map((o) => o.id)

  const results = []
  for (const orgId of orgIds) {
    results.push(await releaseExpiredDepositsForOrg(orgId))
  }

  const totals = results.reduce(
    (acc, r) => ({ released: acc.released + r.released, skipped: acc.skipped + r.skipped }),
    { released: 0, skipped: 0 },
  )

  return NextResponse.json({
    ok:    true,
    orgs:  orgIds.length,
    ...totals,
    ranAt: new Date().toISOString(),
  })
}
