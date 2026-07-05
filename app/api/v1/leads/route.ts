import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { validateApiKey }            from '@/lib/api/keys'
import { isFeatureAllowed }          from '@/lib/plans/gating'

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-api-key') ?? ''
  const auth = await validateApiKey(key)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const allowed = await isFeatureAllowed(auth.organizationId, 'api_webhooks')
  if (!allowed) return NextResponse.json({ error: 'plan_required', plan: 'premium' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const contact_name    = typeof body.contact_name    === 'string' ? body.contact_name.trim()    : null
  const contact_phone   = typeof body.contact_phone   === 'string' ? body.contact_phone.trim()   : null
  const source_channel  = typeof body.source_channel  === 'string' ? body.source_channel.trim()  : 'api'
  const raw_content     = typeof body.raw_content     === 'string' ? body.raw_content.trim()     : null

  if (!contact_name && !contact_phone) {
    return NextResponse.json({ error: 'contact_name or contact_phone required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Resolve default branch for this org
  const { data: branch } = await sb
    .from('branches')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .single()

  const sla_due_at = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30-min SLA

  const { data: intake, error } = await sb
    .from('intakes')
    .insert({
      organization_id: auth.organizationId,
      branch_id:       branch?.id ?? null,
      contact_name,
      contact_phone,
      source_channel,
      raw_content,
      status:          'new',
      priority:        'medium',
      sla_due_at,
    })
    .select('id, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: intake }, { status: 201 })
}
