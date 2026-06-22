import { createAdminClient } from '@/lib/supabase/admin'

export async function sendSalesWhatsApp(to: string, body: string, prospectId?: string): Promise<void> {
  const token         = process.env.SALES_WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.SALES_WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    console.warn('[sales-bot] SALES_WHATSAPP_ACCESS_TOKEN or SALES_WHATSAPP_PHONE_NUMBER_ID not set')
    return
  }

  const [res] = await Promise.all([
    fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    }),
    prospectId
      ? (createAdminClient() as any)
          .from('sales_messages')
          .insert({ prospect_id: prospectId, direction: 'outbound', body })
      : Promise.resolve(),
  ])

  if (!res.ok) {
    const err = await res.text()
    console.error('[sales-bot] send error', res.status, err)
  }
}
