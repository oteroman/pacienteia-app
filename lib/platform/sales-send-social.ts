import { createAdminClient } from '@/lib/supabase/admin'

// Sends a Paxi reply via PacienteIA's own Facebook Messenger page.
// `to` is the prospect's PSID (Page-Scoped User ID).
export async function sendPaxiFacebook(to: string, body: string, prospectId?: string): Promise<void> {
  const sb = createAdminClient() as any
  const { data: config } = await sb
    .from('platform_social_config')
    .select('page_id, access_token')
    .eq('platform', 'facebook')
    .maybeSingle()

  if (!config) {
    console.warn('[paxi-fb] platform_social_config not configured')
    return
  }

  const [res] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v21.0/${config.page_id}/messages?access_token=${config.access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: to },
          message:   { text: body },
          messaging_type: 'RESPONSE',
        }),
      },
    ),
    prospectId
      ? sb.from('sales_messages').insert({ prospect_id: prospectId, direction: 'outbound', body })
      : Promise.resolve(),
  ])

  if (!res.ok) {
    const err = await res.text()
    console.error('[paxi-fb] send error', res.status, err)
  }
}

// Sends a Paxi reply via PacienteIA's own Instagram account.
// `to` is the prospect's Instagram-Scoped User ID (IGSID).
export async function sendPaxiInstagram(to: string, body: string, prospectId?: string): Promise<void> {
  const sb = createAdminClient() as any
  const { data: config } = await sb
    .from('platform_social_config')
    .select('instagram_account_id, access_token')
    .eq('platform', 'facebook')
    .maybeSingle()

  if (!config?.instagram_account_id) {
    console.warn('[paxi-ig] instagram_account_id not configured')
    return
  }

  const [res] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v21.0/${config.instagram_account_id}/messages?access_token=${config.access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: to },
          message:   { text: body },
        }),
      },
    ),
    prospectId
      ? sb.from('sales_messages').insert({ prospect_id: prospectId, direction: 'outbound', body })
      : Promise.resolve(),
  ])

  if (!res.ok) {
    const err = await res.text()
    console.error('[paxi-ig] send error', res.status, err)
  }
}
