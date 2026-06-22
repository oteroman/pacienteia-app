'use server'

import { revalidatePath }      from 'next/cache'
import { redirect }            from 'next/navigation'
import { createAdminClient }   from '@/lib/supabase/admin'
import { createClient }        from '@/lib/supabase/server'
import { getActiveContext, setActiveBranchId } from '@/lib/tenant/context'
import { isFeatureAllowed }    from '@/lib/plans/gating'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createBranch(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ctx = await getActiveContext()
  if (!ctx) throw new Error('No context')

  const allowed = await isFeatureAllowed(ctx.organizationId, 'multi_branch')
  if (!allowed) throw new Error('Plan Premium requerido para múltiples sucursales')

  const name    = (formData.get('name')    as string ?? '').trim()
  const phone   = (formData.get('phone')   as string ?? '').trim()
  const address = (formData.get('address') as string ?? '').trim()
  const city    = (formData.get('city')    as string ?? 'Lima').trim() || 'Lima'

  if (!name) throw new Error('Nombre requerido')

  const sb   = createAdminClient() as any
  const slug = toSlug(name)

  // Ensure unique slug within org
  const { data: existing } = await sb
    .from('branches')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  const finalSlug = existing ? `${slug}-${Date.now()}` : slug

  const { error } = await sb.from('branches').insert({
    organization_id: ctx.organizationId,
    name,
    slug: finalSlug,
    phone:   phone   || null,
    address: address || null,
    city,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/settings/branches')
}

export async function updateBranch(branchId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ctx = await getActiveContext()
  if (!ctx) throw new Error('No context')

  const name    = (formData.get('name')    as string ?? '').trim()
  const phone   = (formData.get('phone')   as string ?? '').trim()
  const address = (formData.get('address') as string ?? '').trim()
  const city    = (formData.get('city')    as string ?? '').trim() || 'Lima'

  if (!name) throw new Error('Nombre requerido')

  const sb = createAdminClient() as any

  // Verify branch belongs to org
  const { data: branch } = await sb
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!branch) throw new Error('Sucursal no encontrada')

  const { error } = await sb
    .from('branches')
    .update({ name, phone: phone || null, address: address || null, city })
    .eq('id', branchId)

  if (error) throw new Error(error.message)

  revalidatePath('/settings/branches')
}

export async function switchBranch(branchId: string, _fd: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ctx = await getActiveContext()
  if (!ctx) throw new Error('No context')

  const sb = createAdminClient() as any

  // Verify branch belongs to org
  const { data: branch } = await sb
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!branch) throw new Error('Sucursal no encontrada')

  await setActiveBranchId(branchId)
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function deleteBranch(branchId: string, _fd: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ctx = await getActiveContext()
  if (!ctx) throw new Error('No context')

  // Can't delete the active branch
  if (branchId === ctx.branchId) throw new Error('No puedes eliminar la sucursal activa')

  const sb = createAdminClient() as any

  // Must have at least 2 branches to delete one
  const { count } = await sb
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)

  if ((count ?? 0) <= 1) throw new Error('No puedes eliminar la única sucursal')

  const { error } = await sb
    .from('branches')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', branchId)
    .eq('organization_id', ctx.organizationId)

  if (error) throw new Error(error.message)

  revalidatePath('/settings/branches')
}
