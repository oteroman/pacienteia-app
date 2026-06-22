'use server'

import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { encryptToken }      from '@/lib/crypto/whatsapp-token'

export async function savePaymentSettings(formData: FormData): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) return

  const method          = (formData.get('payment_method') as string) ?? 'none'
  const depositAmount   = parseInt(formData.get('payment_deposit_amount') as string, 10) || 50
  const qrImageUrl      = (formData.get('payment_qr_image_url') as string)?.trim() || null
  const merchantId      = (formData.get('niubiz_merchant_id') as string)?.trim() || null
  const clientId        = (formData.get('niubiz_client_id') as string)?.trim()
  const clientSecret    = (formData.get('niubiz_client_secret') as string)?.trim()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const updates: Record<string, unknown> = {
    payment_method:         method,
    payment_deposit_amount: depositAmount,
    payment_qr_image_url:   qrImageUrl,
    niubiz_merchant_id:     merchantId,
  }

  // Only update encrypted credentials if non-empty (blank = keep existing)
  if (clientId)     updates.niubiz_client_id_enc     = encryptToken(clientId)
  if (clientSecret) updates.niubiz_client_secret_enc = encryptToken(clientSecret)

  await sb
    .from('branch_whatsapp_config')
    .update(updates)
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
    .eq('status', 'active')

  revalidatePath('/settings/payments')
}

export async function confirmPaymentManual(appointmentId: string): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  await sb
    .from('appointments')
    .update({
      payment_status:  'paid',
      payment_paid_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('organization_id', ctx.organizationId)

  revalidatePath(`/appointments/${appointmentId}`)
}
