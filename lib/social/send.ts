import { createAdminClient } from '@/lib/supabase/admin'

interface SendResult {
  messageId: string | null
  error: string | null
}

// Send a text message via Facebook Messenger (using the Page ID + page access token)
export async function sendFacebookMessage(opts: {
  organizationId: string
  recipientId: string   // PSID of the Facebook user
  body: string
}): Promise<SendResult> {
  const sb = createAdminClient() as any
  const { data: conn } = await sb
    .from('social_connections')
    .select('page_id, access_token')
    .eq('organization_id', opts.organizationId)
    .eq('platform', 'facebook')
    .eq('is_active', true)
    .maybeSingle()

  if (!conn) return { messageId: null, error: 'Facebook not connected' }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${conn.page_id}/messages?access_token=${conn.access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: opts.recipientId },
        message:   { text: opts.body },
        messaging_type: 'RESPONSE',
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('[fb-send] error', err)
    return { messageId: null, error: `Facebook API error: ${res.status}` }
  }

  const data = await res.json() as { message_id?: string }
  return { messageId: data.message_id ?? null, error: null }
}

// Send a text message via Instagram DMs (using the IG Business Account ID + page access token)
export async function sendInstagramMessage(opts: {
  organizationId: string
  recipientId: string   // Instagram-Scoped User ID
  body: string
}): Promise<SendResult> {
  const sb = createAdminClient() as any
  const { data: conn } = await sb
    .from('social_connections')
    .select('instagram_account_id, access_token')
    .eq('organization_id', opts.organizationId)
    .eq('platform', 'facebook')
    .eq('is_active', true)
    .maybeSingle()

  if (!conn?.instagram_account_id) return { messageId: null, error: 'Instagram not connected' }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${conn.instagram_account_id}/messages?access_token=${conn.access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: opts.recipientId },
        message:   { text: opts.body },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('[ig-send] error', err)
    return { messageId: null, error: `Instagram API error: ${res.status}` }
  }

  const data = await res.json() as { message_id?: string }
  return { messageId: data.message_id ?? null, error: null }
}
