/**
 * Niubiz "Cobro con Link" integration.
 *
 * Credentials (per branch, stored encrypted in branch_whatsapp_config):
 *   niubiz_merchant_id      — número de comercio asignado por Niubiz
 *   niubiz_client_id_enc    — Client ID del API (encrypted)
 *   niubiz_client_secret_enc — Client Secret del API (encrypted)
 *
 * Env var required:
 *   NIUBIZ_ENV — 'sandbox' | 'production'  (default: 'production')
 *
 * Niubiz API docs: https://developers.niubiz.com.pe/
 *
 * Flow:
 *   1. POST /api.security/v1/security   → Bearer token (valid ~10 min)
 *   2. POST /api.cobros/v1/linkdepago   → { linkPago, purchaseNumber }
 *   3. Patient clicks link → pays → Niubiz POSTs webhook to /api/webhooks/niubiz
 */

const BASE_SANDBOX    = 'https://apisandbox.niubiz.com.pe'
const BASE_PRODUCTION = 'https://api.niubiz.com.pe'

function base(): string {
  return process.env.NIUBIZ_ENV === 'sandbox' ? BASE_SANDBOX : BASE_PRODUCTION
}

export interface NiubizPaymentResult {
  url:           string
  purchaseNumber: string
}

async function getSecurityToken(merchantId: string, clientId: string, clientSecret: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${base()}/api.security/v1/security`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&scope=mercado`,
  })
  if (!res.ok) throw new Error(`Niubiz auth failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function generateNiubizPaymentLink(opts: {
  merchantId:    string
  clientId:      string
  clientSecret:  string
  appointmentId: string
  amountSoles:   number
  patientName:   string
  description:   string
  expiresInMin?: number
  callbackUrl:   string
}): Promise<NiubizPaymentResult> {
  const token          = await getSecurityToken(opts.merchantId, opts.clientId, opts.clientSecret)
  const purchaseNumber = `APT-${opts.appointmentId.slice(0, 8).toUpperCase()}-${Date.now()}`
  const expiresInMin   = opts.expiresInMin ?? 1440  // 24 h default

  const res = await fetch(`${base()}/api.cobros/v1/linkdepago`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      merchantId:      opts.merchantId,
      purchaseNumber,
      amount:          opts.amountSoles,
      currency:        'PEN',
      description:     opts.description,
      clientName:      opts.patientName,
      expirationMinutes: expiresInMin,
      urlCallback:     opts.callbackUrl,
    }),
  })

  if (!res.ok) {
    throw new Error(`Niubiz link creation failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json() as { linkPago?: string; purchaseNumber?: string }

  if (!data.linkPago) throw new Error('Niubiz: linkPago missing in response')

  return {
    url:            data.linkPago,
    purchaseNumber: data.purchaseNumber ?? purchaseNumber,
  }
}
