import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { validateApiKey }            from '@/lib/api/keys'
import { isFeatureAllowed }          from '@/lib/plans/gating'

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-api-key') ?? ''
  const auth = await validateApiKey(key)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const allowed = await isFeatureAllowed(auth.organizationId, 'api_webhooks')
  if (!allowed) return NextResponse.json({ error: 'plan_required', plan: 'premium' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const date   = searchParams.get('date')  // YYYY-MM-DD
  const status = searchParams.get('status')
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let query = sb
    .from('appointments')
    .select('id, patient_id, treatment_type, scheduled_at, status, payment_status, price, notes, created_at, patients(full_name, phone)')
    .eq('organization_id', auth.organizationId)
    .order('scheduled_at', { ascending: false })
    .limit(limit)

  if (date) {
    const start = `${date}T00:00:00`
    const end   = `${date}T23:59:59`
    query = query.gte('scheduled_at', start).lte('scheduled_at', end)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count: data?.length ?? 0 })
}
