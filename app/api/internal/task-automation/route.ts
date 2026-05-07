/**
 * GET /api/internal/task-automation
 *
 * Two auth paths:
 *   - Vercel Cron: Authorization: Bearer <CRON_SECRET>  (auto-injected by Vercel)
 *   - Manual:      ?key=<ADMIN_DASHBOARD_SECRET>        (from playbook dashboard)
 *
 * Schedule (vercel.json): 0 9 * * *  → runs daily at 09:00 UTC
 */

import { NextRequest, NextResponse } from 'next/server'
import { runTaskAutomation } from '@/lib/customer-health/automation'

function isAuthorized(request: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET

  const bearer = request.headers.get('authorization')
  const key    = request.nextUrl.searchParams.get('key')

  return (!!cronSecret && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key === adminSecret)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runTaskAutomation()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[task-automation] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
