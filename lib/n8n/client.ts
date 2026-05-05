// n8n webhook client — internal only, never referenced in client-side code

const BASE_URL = process.env.N8N_WEBHOOK_BASE_URL

export type WebhookEvent =
  | 'lead.created'
  | 'appointment.created'
  | 'appointment.upcoming'
  | 'patient.inactive'
  | 'post_treatment.followup'

export interface WebhookPayload {
  clinic_id: string
  event_type: WebhookEvent
  entity_type?: string
  entity_id?: string
  [key: string]: unknown
}

export async function triggerWebhook(payload: WebhookPayload): Promise<void> {
  if (!BASE_URL) {
    console.warn('[n8n] N8N_WEBHOOK_BASE_URL not set — skipping webhook')
    return
  }

  const res = await fetch(`${BASE_URL}/webhook/${payload.event_type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error(`[n8n] Webhook failed: ${payload.event_type}`, await res.text())
  }
}
