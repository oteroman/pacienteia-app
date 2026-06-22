'use server'
import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { sendWhatsAppText }  from '@/lib/whatsapp/send'
import { decryptToken }      from '@/lib/crypto/whatsapp-token'

async function getWaConfig(sb: ReturnType<typeof createAdminClient>, orgId: string, branchId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('branch_whatsapp_config')
    .select('phone_number_id, access_token_enc')
    .eq('organization_id', orgId)
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .maybeSingle()
  return data
}

export async function callPatient(id: string): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) return
  const { organizationId, branchId } = ctx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: entry } = await sb
    .from('waiting_queue')
    .select('phone, patient_name')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  await sb.from('waiting_queue')
    .update({ status: 'called', called_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (entry?.phone) {
    const cfg = await getWaConfig(sb, organizationId, branchId)
    if (cfg) {
      try {
        const token = decryptToken(cfg.access_token_enc)
        await sendWhatsAppText(
          entry.phone,
          `¡${entry.patient_name}, es tu turno! 🟢\n\nPor favor pasa a la sala de atención. ¡Te esperamos! 😊`,
          cfg.phone_number_id,
          token,
        )
      } catch { /* non-fatal */ }
    }
  }

  revalidatePath('/waiting-room')
}

export async function markDone(id: string): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('waiting_queue')
    .update({ status: 'done', done_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
  revalidatePath('/waiting-room')
}

export async function removeFromQueue(id: string): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('waiting_queue')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
  revalidatePath('/waiting-room')
}

export async function saveWaPhone(formData: FormData): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) return
  const waPhone = (formData.get('wa_phone') as string | null)?.trim() ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('branch_whatsapp_config')
    .update({ wa_phone: waPhone || null })
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
  revalidatePath('/settings/waiting-room')
}
