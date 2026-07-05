'use server'

import { revalidatePath }  from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'

export async function logAdSpend(formData: FormData): Promise<void> {
  const { organizationId, branchId } = await getActiveContext() ?? {}
  if (!organizationId) return

  const spend_date   = (formData.get('spend_date')    as string)?.trim()
  const amount_str   = (formData.get('amount_soles')  as string)?.trim()
  const source       = (formData.get('source')         as string)?.trim() || 'facebook'
  const campaign_name = (formData.get('campaign_name') as string)?.trim() || null
  const notes        = (formData.get('notes')           as string)?.trim() || null

  if (!spend_date) return
  const amount = parseFloat(amount_str)
  if (isNaN(amount) || amount <= 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { error } = await sb.from('ad_spend').insert({
    organization_id: organizationId,
    branch_id:       branchId ?? null,
    spend_date,
    amount_soles:    amount,
    source,
    campaign_name,
    notes,
  })

  if (error) return
  revalidatePath('/analytics/marketing')
}

export async function deleteAdSpend(id: string): Promise<void> {
  const { organizationId } = await getActiveContext() ?? {}
  if (!organizationId) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('ad_spend').delete().eq('id', id).eq('organization_id', organizationId)
  revalidatePath('/analytics/marketing')
}
