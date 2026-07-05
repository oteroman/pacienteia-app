/**
 * Payment request dispatcher.
 *
 * Reads branch payment config and routes to the right provider:
 *   none      → no-op
 *   qr_image  → send QR image via WhatsApp + text instructions
 *   niubiz    → generate payment link + send via WhatsApp
 *
 * Called after appointment confirmation (booking flow or reminder "1").
 */

import { createAdminClient }         from '@/lib/supabase/admin'
import { decryptToken }              from '@/lib/crypto/whatsapp-token'
import { sendWhatsAppText, sendWhatsAppImage } from '@/lib/whatsapp/send'
import { generateNiubizPaymentLink } from '@/lib/payments/niubiz'
import { firstNameOf }               from '@/lib/whatsapp/reminders'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

export interface PaymentRequestOpts {
  sb?:            SB
  organizationId: string
  branchId:       string
  appointmentId:  string
  contactPhone:   string
  patientName:    string | null
  serviceName:    string
  scheduledAt:    string  // ISO UTC
}

interface BranchPaymentConfig {
  payment_method:           'none' | 'qr_image' | 'niubiz'
  payment_deposit_amount:   number
  payment_qr_image_url:     string | null
  niubiz_merchant_id:       string | null
  niubiz_client_id_enc:     string | null
  niubiz_client_secret_enc: string | null
}

export async function sendPaymentRequest(opts: PaymentRequestOpts): Promise<void> {
  const sb: SB = opts.sb ?? createAdminClient()

  const { data: config } = await sb
    .from('branch_whatsapp_config')
    .select('payment_method, payment_deposit_amount, payment_qr_image_url, niubiz_merchant_id, niubiz_client_id_enc, niubiz_client_secret_enc')
    .eq('branch_id', opts.branchId)
    .eq('status', 'active')
    .single() as { data: BranchPaymentConfig | null }

  if (!config || config.payment_method === 'none') return

  const firstName = firstNameOf(opts.patientName ?? opts.contactPhone)
  const amount    = config.payment_deposit_amount ?? 50

  if (config.payment_method === 'qr_image') {
    await handleQrImagePayment({ sb, config, opts, firstName, amount })
    return
  }

  if (config.payment_method === 'niubiz') {
    await handleNiubizPayment({ sb, config, opts, firstName, amount })
    return
  }
}

// ── QR Image flow ─────────────────────────────────────────────────────────────

async function handleQrImagePayment(p: {
  sb:        SB
  config:    BranchPaymentConfig
  opts:      PaymentRequestOpts
  firstName: string
  amount:    number
}): Promise<void> {
  const { sb, config, opts, firstName, amount } = p

  if (!config.payment_qr_image_url) return  // QR not configured yet

  const caption =
    `Hola ${firstName} 👋 Para *confirmar tu cupo*, te pedimos una separación de *S/ ${amount}*.\n\n` +
    `Escanea el QR con tu app Yape o Plin, ingresa el monto y envíanos el comprobante por este chat.\n\n` +
    `_Tu cita queda asegurada una vez confirmemos el pago_ ✅`

  await sendWhatsAppImage({
    branchId: opts.branchId,
    to:       opts.contactPhone,
    imageUrl: config.payment_qr_image_url,
    caption,
  })

  await sb
    .from('appointments')
    .update({ payment_status: 'pending', payment_requested_at: new Date().toISOString() })
    .eq('id', opts.appointmentId)
}

// ── Niubiz flow ───────────────────────────────────────────────────────────────

async function handleNiubizPayment(p: {
  sb:        SB
  config:    BranchPaymentConfig
  opts:      PaymentRequestOpts
  firstName: string
  amount:    number
}): Promise<void> {
  const { sb, config, opts, firstName, amount } = p

  if (!config.niubiz_merchant_id || !config.niubiz_client_id_enc || !config.niubiz_client_secret_enc) return

  let clientId: string, clientSecret: string
  try {
    clientId     = decryptToken(config.niubiz_client_id_enc)
    clientSecret = decryptToken(config.niubiz_client_secret_enc)
  } catch {
    console.error('[payments] failed to decrypt Niubiz credentials')
    return
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pacienteia.com'}/api/webhooks/niubiz`

  let result: Awaited<ReturnType<typeof generateNiubizPaymentLink>>
  try {
    result = await generateNiubizPaymentLink({
      merchantId:    config.niubiz_merchant_id,
      clientId,
      clientSecret,
      appointmentId: opts.appointmentId,
      amountSoles:   amount,
      patientName:   opts.patientName ?? opts.contactPhone,
      description:   `Separación de cita — ${opts.serviceName}`,
      callbackUrl,
    })
  } catch (err) {
    console.error('[payments] Niubiz link generation failed:', err)
    return
  }

  await sb
    .from('appointments')
    .update({
      payment_status:       'pending',
      payment_link:         result.url,
      payment_order_id:     result.purchaseNumber,
      payment_requested_at: new Date().toISOString(),
    })
    .eq('id', opts.appointmentId)

  const body =
    `Hola ${firstName} 👋 Para *confirmar tu cupo*, te pedimos una separación de *S/ ${amount}*.\n\n` +
    `Puedes pagar con tarjeta, Yape o Plin desde este link:\n${result.url}\n\n` +
    `_El link vence en 24 horas. Tu cita queda asegurada al completar el pago_ ✅`

  await sendWhatsAppText({
    branchId: opts.branchId,
    to:       opts.contactPhone,
    body,
  })
}
