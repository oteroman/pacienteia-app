import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { processIntake }             from '@/app/actions/intake'
import type { IntakeChannel }        from '@/lib/intake/index'

const CHANNEL_MAP: Record<string, IntakeChannel> = {
  whatsapp:  'whatsapp',
  instagram: 'instagram',
  facebook:  'facebook',
  tiktok:    'tiktok',
  web:       'webform',
  webform:   'webform',
  call:      'call',
  manual:    'manual',
}

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-webhook-secret')
  return !!process.env.WEBHOOK_SECRET && secret === process.env.WEBHOOK_SECRET
}

// POST /api/webhooks/leads
// Called by n8n (or any external integration) when a lead message arrives.
// clinic_id (or org_id) can be the UUID or the org slug.
// source maps to IntakeChannel; defaults to 'whatsapp'.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { clinic_id, org_id, source, phone, message, name, email } = body as {
    clinic_id?: string
    org_id?:    string
    source?:    string
    phone?:     string
    message?:   string
    name?:      string
    email?:     string
  }

  const orgParam = org_id ?? clinic_id
  if (!orgParam || !message?.trim()) {
    return NextResponse.json({ error: 'org_id and message are required' }, { status: 400 })
  }

  // Resolve org by UUID or slug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isUUID = uuidPattern.test(orgParam)

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq(isUUID ? 'id' : 'slug', orgParam)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'org_not_found' }, { status: 404 })
  }

  // Get default branch
  const { data: branch } = await sb
    .from('branches')
    .select('id')
    .eq('organization_id', org.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const channel: IntakeChannel = CHANNEL_MAP[source ?? ''] ?? 'whatsapp'

  const intakeId = await processIntake({
    organizationId: org.id as string,
    branchId:       branch?.id ?? org.id,
    channel,
    contactPhone:   phone   || undefined,
    contactName:    name    || undefined,
    contactEmail:   email   || undefined,
    rawContent:     message.trim(),
  })

  if (!intakeId) {
    return NextResponse.json({ error: 'intake_failed' }, { status: 500 })
  }

  return NextResponse.json({ id: intakeId }, { status: 201 })
}
