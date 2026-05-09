import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient }           from '@/lib/supabase/admin'

// GET /api/whatsapp/webhook
// Meta verification handshake — responds with hub.challenge on success.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

// POST /api/whatsapp/webhook
// Receives WhatsApp Cloud API events from Meta.
// Validates HMAC-SHA256 signature, resolves branch by phone_number_id,
// writes raw payload to webhook_queue, and returns 200 immediately.
export async function POST(req: NextRequest) {
  // Read raw body as text before any transformation.
  // Meta computes HMAC over the exact bytes it sends; any re-encoding or
  // JSON round-trip would alter whitespace/escaping and break signature validation.
  const rawBody = await req.text()

  const signature = req.headers.get('x-hub-signature-256') ?? ''
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? ''
  if (!appSecret || !isSignatureValid(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Parse — on malformed JSON ack and drop (Meta would retry forever otherwise)
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse(null, { status: 200 })
  }

  // Only handle WhatsApp Business Account events
  if (payload.object !== 'whatsapp_business_account') {
    return new NextResponse(null, { status: 200 })
  }

  const phoneNumberId = extractPhoneNumberId(payload)
  const eventId       = extractEventId(payload)       // wamid or status id, for log tracing

  if (!phoneNumberId) {
    // Valid signature but missing routing key — unusual, log for support
    console.warn('[wa-webhook] missing phone_number_id', { eventId })
    return new NextResponse(null, { status: 200 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: config } = await sb
    .from('branch_whatsapp_config')
    .select('branch_id, organization_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'active')
    .single()

  if (!config) {
    // phone_number_id received but no active branch configured.
    // Could be a test number, a recently disconnected branch, or a misconfiguration.
    // Log for support diagnostics; still return 200 so Meta does not retry.
    console.warn('[wa-webhook] no active branch for phone_number_id', { phoneNumberId, eventId })
    return new NextResponse(null, { status: 200 })
  }

  await sb.from('webhook_queue').insert({
    organization_id: config.organization_id,
    branch_id:       config.branch_id,
    phone_number_id: phoneNumberId,
    source:          'whatsapp',
    payload,
    // eventId is not stored as a separate column to avoid a migration;
    // the consumer (n8n) can extract it from payload->entry->changes->value->messages[0].id
    // for idempotency checks on its side.
  })

  return new NextResponse(null, { status: 200 })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSignatureValid(rawBody: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) return false
  const expected = signature.slice(7)
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'))
  } catch {
    return false
  }
}

function extractPhoneNumberId(payload: Record<string, unknown>): string | null {
  try {
    const entry  = (payload.entry  as unknown[])?.[0] as Record<string, unknown>
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
    const value  = change?.value   as Record<string, unknown>
    const meta   = value?.metadata as Record<string, unknown>
    return typeof meta?.phone_number_id === 'string' ? meta.phone_number_id : null
  } catch {
    return null
  }
}

// Extracts the first traceable wamid from the payload (message event or status update).
// Used only for logging — the full payload is stored in webhook_queue.payload JSONB.
function extractEventId(payload: Record<string, unknown>): string | null {
  try {
    const entry    = (payload.entry    as unknown[])?.[0] as Record<string, unknown>
    const change   = (entry?.changes   as unknown[])?.[0] as Record<string, unknown>
    const value    = change?.value     as Record<string, unknown>
    const messages = value?.messages   as { id?: string }[] | undefined
    const statuses = value?.statuses   as { id?: string }[] | undefined
    return messages?.[0]?.id ?? statuses?.[0]?.id ?? null
  } catch {
    return null
  }
}
