import { NextRequest, NextResponse }   from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { extractInboundMessage }       from '@/lib/whatsapp/extract'
import { handleSalesBotMessage }       from '@/lib/platform/sales-bot'

// GET /api/whatsapp/sales/webhook
// Meta verification handshake for the sales bot Meta app.
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

// POST /api/whatsapp/sales/webhook
// Receives messages from the sales bot WhatsApp number (separate Meta app).
// HMAC is validated with SALES_WHATSAPP_APP_SECRET — different from the clinics app.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-hub-signature-256') ?? ''
  const appSecret = process.env.SALES_WHATSAPP_APP_SECRET ?? ''
  if (!appSecret || !isSignatureValid(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse(null, { status: 200 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return new NextResponse(null, { status: 200 })
  }

  const extracted = extractInboundMessage(payload)
  if (extracted?.body && extracted.mediaType === 'text') {
    try {
      await handleSalesBotMessage(extracted.contactPhone, extracted.body)
    } catch (err) {
      console.error('[sales-webhook]', err)
    }
  }

  return new NextResponse(null, { status: 200 })
}

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
