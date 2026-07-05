'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin, requireRole, type PlatformRole } from '@/lib/platform/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/** List all platform staff (superadmin-only) */
export async function listPlatformAdmins() {
  const pu = await requirePlatformAdmin()
  requireRole(pu, ['superadmin'])

  const sb = createAdminClient() as any
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, email:id, platform_role, commission_rate')
    .not('platform_role', 'is', null)
    .order('platform_role')

  // profiles table doesn't store email directly — pull from auth.users
  const ids: string[] = (data ?? []).map((r: any) => r.id)
  if (!ids.length) return []

  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of (users ?? [])) emailMap[u.id] = u.email ?? ''

  return (data ?? []).map((r: any) => ({
    id:              r.id,
    email:           emailMap[r.id] ?? '',
    full_name:       r.full_name ?? '',
    platform_role:   r.platform_role as PlatformRole,
    commission_rate: r.commission_rate ?? 0,
  }))
}

/** Invite a new platform staff member by email */
export async function invitePlatformAdmin(formData: FormData): Promise<void> {
  const pu = await requirePlatformAdmin()
  requireRole(pu, ['superadmin'])

  const email           = (formData.get('email')           as string).trim()
  const role            = (formData.get('role')            as PlatformRole)
  const commission_rate = parseFloat((formData.get('commission_rate') as string) ?? '0')

  if (!email || !role) throw new Error('Email y rol son requeridos.')

  const sb = createAdminClient() as any

  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  let userId = (users as any[])?.find((u: any) => u.email === email)?.id ?? null

  if (!userId) {
    const { data: inv, error } = await sb.auth.admin.inviteUserByEmail(email)
    if (error) throw new Error(error.message)
    userId = inv.user.id
  }

  await sb.auth.admin.updateUserById(userId, {
    app_metadata: { platform_role: role },
  })

  await sb.from('profiles').upsert({
    id:              userId,
    platform_role:   role,
    commission_rate: role === 'sales' ? commission_rate : 0,
  }, { onConflict: 'id' })

  revalidatePath('/platform/admins')
}

/** Update a platform staff member's role or commission */
export async function updatePlatformAdmin(formData: FormData) {
  const pu = await requirePlatformAdmin()
  requireRole(pu, ['superadmin'])

  const userId          = formData.get('user_id') as string
  const role            = formData.get('role') as PlatformRole
  const commission_rate = parseFloat((formData.get('commission_rate') as string) ?? '0')

  if (!userId || !role) return { error: 'Datos incompletos.' }

  const sb = createAdminClient() as any

  await sb.auth.admin.updateUserById(userId, {
    app_metadata: { platform_role: role },
  })

  await sb.from('profiles').upsert({
    id:              userId,
    platform_role:   role,
    commission_rate: role === 'sales' ? commission_rate : 0,
  }, { onConflict: 'id' })

  revalidatePath('/platform/admins')
}

/** Remove platform role from a user */
export async function removePlatformAdmin(userId: string, _fd: FormData): Promise<void> {
  const pu = await requirePlatformAdmin()
  requireRole(pu, ['superadmin'])

  if (userId === pu.id) throw new Error('No puedes quitarte el rol a ti mismo.')

  const sb = createAdminClient() as any

  await sb.auth.admin.updateUserById(userId, {
    app_metadata: { platform_role: null },
  })

  await sb.from('profiles').update({ platform_role: null, commission_rate: 0 }).eq('id', userId)

  revalidatePath('/platform/admins')
}

/** Assign a sales prospect to a rep */
export async function assignProspectToRep(prospectId: string, repId: string | null) {
  const pu = await requirePlatformAdmin()
  requireRole(pu, ['superadmin'])

  const sb = createAdminClient() as any
  await sb.from('sales_prospects').update({ assigned_to: repId }).eq('id', prospectId)
  revalidatePath('/platform/sales')
  revalidatePath('/platform/crm')
}

/** Form action variant: prospectId bound, rep_id from FormData */
export async function assignProspectToRepAction(prospectId: string, formData: FormData): Promise<void> {
  const repId = (formData.get('rep_id') as string) || null
  await assignProspectToRep(prospectId, repId)
}

/** Set acquisition rep on an organization */
export async function setAcquisitionRep(orgId: string, repId: string | null) {
  const pu = await requirePlatformAdmin()
  requireRole(pu, ['superadmin'])

  const sb = createAdminClient() as any
  await sb.from('organizations').update({ acquisition_rep_id: repId }).eq('id', orgId)
  revalidatePath('/platform/crm')
  revalidatePath(`/platform/tenants/${orgId}`)
}

/** Form action variant: orgId bound, repId from FormData 'rep_id' field */
export async function setAcquisitionRepAction(orgId: string, formData: FormData) {
  const repId = (formData.get('rep_id') as string) || null
  await setAcquisitionRep(orgId, repId)
}
