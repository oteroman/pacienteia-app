'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'

async function ctx() {
  const c = await getActiveContext()
  if (!c) redirect('/org-selector')
  return c
}

export async function createService(formData: FormData) {
  const { organizationId, branchId } = await ctx()
  const name              = (formData.get('name') as string).trim()
  const priceRaw          = formData.get('price') as string
  const durationRaw       = formData.get('duration_min') as string
  const retreatmentRaw    = formData.get('retreatment_days') as string
  const price             = priceRaw       ? parseFloat(priceRaw)    : null
  const duration_min      = durationRaw    ? parseInt(durationRaw)   : null
  const retreatment_days  = retreatmentRaw ? parseInt(retreatmentRaw) : null

  if (!name) return

  const sb = createAdminClient() as any
  const { error } = await sb.from('services').insert({
    organization_id: organizationId,
    branch_id:       branchId,
    name,
    price:            isNaN(price as number)            ? null : price,
    duration_min:     isNaN(duration_min as number)     ? null : duration_min,
    retreatment_days: isNaN(retreatment_days as number) ? null : retreatment_days,
  })

  if (error) { console.error('[createService]', error.message); return }
  revalidatePath('/settings/services')
  redirect('/settings/services?saved=1')
}

export async function toggleServiceActive(formData: FormData) {
  const { organizationId } = await ctx()
  const id       = formData.get('id') as string
  const isActive = formData.get('is_active') === 'true'

  const sb = createAdminClient() as any
  await sb.from('services')
    .update({ is_active: !isActive })
    .eq('id', id)
    .eq('organization_id', organizationId)

  revalidatePath('/settings/services')
}

export async function deleteService(formData: FormData) {
  const { organizationId } = await ctx()
  const id = formData.get('id') as string

  const sb = createAdminClient() as any
  await sb.from('services')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  revalidatePath('/settings/services')
}
