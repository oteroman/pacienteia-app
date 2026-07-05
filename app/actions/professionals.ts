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

export async function createProfessional(formData: FormData) {
  const { organizationId, branchId } = await ctx()
  const name      = (formData.get('name') as string).trim()
  const specialty = (formData.get('specialty') as string | null)?.trim() || null
  const color     = (formData.get('color') as string | null) || '#6366f1'

  if (!name) return

  const sb = createAdminClient() as any
  const { error } = await sb.from('professionals').insert({
    organization_id: organizationId,
    branch_id:       branchId,
    name,
    specialty,
    color,
  })

  if (error) { console.error('[createProfessional]', error.message); return }
  revalidatePath('/settings/professionals')
  redirect('/settings/professionals?saved=1')
}

export async function updateProfessional(formData: FormData) {
  const { organizationId } = await ctx()
  const id        = formData.get('id') as string
  const name      = (formData.get('name') as string).trim()
  const specialty = (formData.get('specialty') as string | null)?.trim() || null
  const color     = (formData.get('color') as string | null) || '#6366f1'

  if (!name) return

  const sb = createAdminClient() as any
  const { error } = await sb
    .from('professionals')
    .update({ name, specialty, color, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) { console.error('[updateProfessional]', error.message); return }
  revalidatePath('/settings/professionals')
  redirect('/settings/professionals?saved=1')
}

export async function toggleProfessionalActive(formData: FormData) {
  const { organizationId } = await ctx()
  const id        = formData.get('id') as string
  const isActive  = formData.get('is_active') === 'true'

  const sb = createAdminClient() as any
  await sb
    .from('professionals')
    .update({ is_active: !isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)

  revalidatePath('/settings/professionals')
}

export async function deleteProfessional(formData: FormData) {
  const { organizationId } = await ctx()
  const id = formData.get('id') as string

  const sb = createAdminClient() as any
  await sb
    .from('professionals')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  revalidatePath('/settings/professionals')
}
