import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken }       from '@/lib/crypto/whatsapp-token'

interface SendTextOptions {
  branchId: string
  to: string
  body: string
}

interface SendImageOptions {
  branchId: string
  to:       string
  imageUrl: string
  caption?: string
}

interface SendResult {
  wamid: string | null
  error: string | null
}

export async function sendWhatsAppText(opts: SendTextOptions): Promise<SendResult> {
  const sb = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = await (sb as any)
    .from('branch_whatsapp_config')
    .select('phone_number_id, access_token_enc')
    .eq('branch_id', opts.branchId)
    .eq('status', 'active')
    .single() as { data: { phone_number_id: string; access_token_enc: string } | null }

  if (!config) {
    return { wamid: null, error: 'No active WhatsApp config for this branch' }
  }

  let accessToken: string
  try {
    accessToken = decryptToken(config.access_token_enc)
  } catch {
    return { wamid: null, error: 'Failed to decrypt WhatsApp access token' }
  }

  const url = `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'text',
      text: { body: opts.body },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[wa-send] error', err)
    return { wamid: null, error: `WhatsApp API error: ${res.status}` }
  }

  const data = await res.json() as { messages?: { id: string }[] }
  const wamid = data.messages?.[0]?.id ?? null
  return { wamid, error: null }
}

export async function sendWhatsAppImage(opts: SendImageOptions): Promise<SendResult> {
  const sb = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = await (sb as any)
    .from('branch_whatsapp_config')
    .select('phone_number_id, access_token_enc')
    .eq('branch_id', opts.branchId)
    .eq('status', 'active')
    .single() as { data: { phone_number_id: string; access_token_enc: string } | null }

  if (!config) return { wamid: null, error: 'No active WhatsApp config for this branch' }

  let accessToken: string
  try {
    accessToken = decryptToken(config.access_token_enc)
  } catch {
    return { wamid: null, error: 'Failed to decrypt WhatsApp access token' }
  }

  const url = `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`

  const imagePayload: Record<string, unknown> = { link: opts.imageUrl }
  if (opts.caption) imagePayload.caption = opts.caption

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:    opts.to,
      type:  'image',
      image: imagePayload,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[wa-send-image] error', err)
    return { wamid: null, error: `WhatsApp API error: ${res.status}` }
  }

  const data = await res.json() as { messages?: { id: string }[] }
  return { wamid: data.messages?.[0]?.id ?? null, error: null }
}
