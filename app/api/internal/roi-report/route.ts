/**
 * /api/internal/roi-report
 *
 * POST — Generates a weekly ROI summary and sends it via WhatsApp to the branch owner(s).
 *        Run every Monday morning (Lima time) via n8n CRON.
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 *
 * Body (JSON):
 *   clinic_id   string  UUID (required)
 *   branch_id   string  UUID (required)
 *   weeks_ago   number  1 = last week (default), 0 = current week
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { sendWhatsAppText }          from '@/lib/whatsapp/send'
import { normalizePhonePE }          from '@/lib/whatsapp/reminders'
import { generateRoiReport, buildRoiMessage } from '@/lib/analytics/roi-report'

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

  const body     = await req.json().catch(() => ({}))
  const orgId    = body.clinic_id as string | undefined
  const branchId = body.branch_id as string | undefined
  const weeksAgo = Number(body.weeks_ago ?? 1)

  if (!orgId || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [{ data: org }, { data: owners }] = await Promise.all([
    sb.from('organizations').select('name').eq('id', orgId).single(),
    sb.from('org_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('branch_id', branchId)
      .in('role', ['owner', 'admin']),
  ])

  const clinicName = org?.name ?? 'la clínica'

  const report  = await generateRoiReport({ organizationId: orgId, branchId, weeksAgo })
  const message = buildRoiMessage(report, clinicName)

  // Send to all owners/admins who have a phone on their patient record (same phone used for WA)
  const ownerIds: string[] = ((owners ?? []) as { user_id: string }[]).map((o) => o.user_id)

  let sent = 0
  for (const userId of ownerIds) {
    const { data: userRecord } = await sb.auth.admin.getUserById(userId)
    const phone = userRecord?.user?.phone
    if (!phone) continue

    const result = await sendWhatsAppText({
      branchId,
      to:   normalizePhonePE(phone),
      body: message,
    })
    if (!result.error) sent++
  }

  return NextResponse.json({ sent, report })
}

// GET — Returns the report JSON without sending (useful for dashboard preview)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const orgId    = req.nextUrl.searchParams.get('clinic_id')
  const branchId = req.nextUrl.searchParams.get('branch_id')
  const weeksAgo = Number(req.nextUrl.searchParams.get('weeks_ago') ?? 1)

  if (!orgId || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).single()

  const report  = await generateRoiReport({ organizationId: orgId, branchId, weeksAgo })
  const message = buildRoiMessage(report, org?.name ?? 'la clínica')

  return NextResponse.json({ report, message })
}
