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
  const q     = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let query = sb
    .from('patients')
    .select('id, full_name, phone, email, dni, status, created_at, last_visit_at')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    // Strip PostgREST filter metacharacters (comma/parens/backslash) to prevent
    // filter injection via ?q=. Patient search only needs letters/digits/spaces.
    const safe = q.replace(/[,()\\]/g, ' ').trim()
    if (safe) {
      query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
    }
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count: data?.length ?? 0 })
}
