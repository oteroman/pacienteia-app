'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'

async function ctx() {
  const c = await getActiveContext()
  if (!c) redirect('/org-selector')
  return c
}

export async function inviteStaffMember(formData: FormData) {
  const { organizationId, branchId } = await ctx()
  const email = (formData.get('email') as string).trim().toLowerCase()
  const role  = (formData.get('role') as string) || 'staff'

  if (!email) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const sb = createAdminClient() as any

  // Check if user already exists in auth — getUserByEmail is O(1), listUsers() is O(n) global
  const { data: { user: existing } } = await sb.auth.admin.getUserByEmail(email)

  let userId: string

  if (existing) {
    userId = existing.id
  } else {
    // Invite new user via Supabase auth
    const { data: invited, error } = await sb.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.pacienteia.com'}/auth/callback`,
    })
    if (error || !invited?.user) {
      console.error('[inviteStaff]', error?.message)
      return
    }
    userId = invited.user.id
  }

  // Add to org_members (upsert to avoid duplicate)
  await sb.from('org_members').upsert(
    { organization_id: organizationId, branch_id: branchId, user_id: userId, role },
    { onConflict: 'organization_id,user_id' }
  )

  revalidatePath('/settings/staff')
  redirect('/settings/staff?saved=1')
}

export async function updateStaffRole(formData: FormData) {
  const { organizationId } = await ctx()
  const userId = formData.get('user_id') as string
  const role   = formData.get('role') as string

  const sb = createAdminClient() as any
  await sb.from('org_members')
    .update({ role })
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  revalidatePath('/settings/staff')
}

export async function setStaffPhone(formData: FormData) {
  const { organizationId } = await ctx()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const raw   = (formData.get('whatsapp_phone') as string ?? '').trim()
  // Normalize: strip +, spaces, dashes
  const phone = raw ? raw.replace(/[\s+\-()]/g, '') : null

  const sb = createAdminClient() as any
  await sb.from('org_members')
    .update({ whatsapp_phone: phone })
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)

  revalidatePath('/settings/staff')
  redirect('/settings/staff?saved=1')
}

export async function removeStaffMember(formData: FormData) {
  const { organizationId } = await ctx()
  const userId = formData.get('user_id') as string

  // Prevent removing yourself
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === userId) return

  const sb = createAdminClient() as any
  await sb.from('org_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .neq('role', 'owner')  // never remove owner

  revalidatePath('/settings/staff')
}
