'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin, setImpersonatedOrgId, clearImpersonation } from '@/lib/platform/auth'
import { setActiveContext } from '@/lib/tenant/context'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionType = 'extend_trial' | 'suspend' | 'reactivate' | 'assign_plan' | 'enter_tenant' | 'exit_tenant'

async function logPlatformAction(
  actorId: string,
  actorEmail: string,
  action: ActionType,
  orgId: string | null,
  orgName: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    const sb = createAdminClient() as any
    await sb.from('platform_audit_log').insert({
      actor_id:          actorId,
      actor_email:       actorEmail,
      action_type:       action,
      organization_id:   orgId,
      organization_name: orgName,
      details,
    })
  } catch {
    // audit log failure must not block the main action
  }
}

export async function extendTrial(orgId: string, orgName: string, days: number, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  const newEnd = new Date()
  newEnd.setDate(newEnd.getDate() + days)

  await sb.from('organizations').update({
    subscription_status: 'trialing',
    trial_ends_at: newEnd.toISOString(),
  }).eq('id', orgId)

  await logPlatformAction(pu.id, pu.email, 'extend_trial', orgId, orgName, { days, new_end: newEnd.toISOString() })
  revalidatePath(`/platform/tenants/${orgId}`)
  redirect(`/platform/tenants/${orgId}?ok=trial`)
}

export async function suspendTenant(orgId: string, orgName: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  await sb.from('organizations').update({ subscription_status: 'cancelled' }).eq('id', orgId)
  await logPlatformAction(pu.id, pu.email, 'suspend', orgId, orgName, {})
  revalidatePath(`/platform/tenants/${orgId}`)
  redirect(`/platform/tenants/${orgId}?ok=suspended`)
}

export async function reactivateTenant(orgId: string, orgName: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  await sb.from('organizations').update({ subscription_status: 'active' }).eq('id', orgId)
  await logPlatformAction(pu.id, pu.email, 'reactivate', orgId, orgName, {})
  revalidatePath(`/platform/tenants/${orgId}`)
  redirect(`/platform/tenants/${orgId}?ok=reactivated`)
}

export async function assignPlan(orgId: string, orgName: string, plan: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  await sb.from('organizations').update({ plan }).eq('id', orgId)
  await logPlatformAction(pu.id, pu.email, 'assign_plan', orgId, orgName, { plan })
  revalidatePath(`/platform/tenants/${orgId}`)
  redirect(`/platform/tenants/${orgId}?ok=plan`)
}

export async function enterTenant(orgId: string, orgName: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  // Fetch the first active branch so the dashboard has org+branch context
  const { data: branch } = await sb
    .from('branches')
    .select('id')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  await setImpersonatedOrgId(orgId)
  // If no branch exists yet (org mid-onboarding), use orgId as placeholder
  await setActiveContext(orgId, branch?.id ?? orgId)
  await logPlatformAction(pu.id, pu.email, 'enter_tenant', orgId, orgName, {})
  revalidatePath('/dashboard')
  revalidatePath('/platform')
  redirect('/dashboard')
}

export async function exitTenant(_fd: FormData) {
  const pu = await requirePlatformAdmin()

  await clearImpersonation()
  await logPlatformAction(pu.id, pu.email, 'exit_tenant', null, null, {})
  revalidatePath('/platform')
  redirect('/platform')
}
