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
// clinic_id can be the UUID or the clinic slug.
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

  const { clinic_id, source, phone, message, name, email } = body as {
    clinic_id?: string
    source?:    string
    phone?:     string
    message?:   string
    name?:      string
    email?:     string
  }

  if (!clinic_id || !message?.trim()) {
    return NextResponse.json({ error: 'clinic_id and message are required' }, { status: 400 })
  }

  // Resolve clinic by UUID or slug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isUUID = uuidPattern.test(clinic_id)

  const { data: clinic } = await sb
    .from('clinics')
    .select('id')
    .eq(isUUID ? 'id' : 'slug', clinic_id)
    .single()

  if (!clinic) {
    return NextResponse.json({ error: 'clinic_not_found' }, { status: 404 })
  }

  const channel: IntakeChannel = CHANNEL_MAP[source ?? ''] ?? 'whatsapp'

  const intakeId = await processIntake({
    clinicId:     clinic.id as string,
    channel,
    contactPhone: phone   || undefined,
    contactName:  name    || undefined,
    contactEmail: email   || undefined,
    rawContent:   message.trim(),
  })

  if (!intakeId) {
    return NextResponse.json({ error: 'intake_failed' }, { status: 500 })
  }

  return NextResponse.json({ id: intakeId }, { status: 201 })
}
