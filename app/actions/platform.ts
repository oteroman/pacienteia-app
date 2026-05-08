'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin, setImpersonatedClinicId, clearImpersonation } from '@/lib/platform/auth'
import { setActiveClinicId } from '@/lib/tenant/active-clinic'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionType = 'extend_trial' | 'suspend' | 'reactivate' | 'assign_plan' | 'enter_tenant' | 'exit_tenant'

async function logPlatformAction(
  actorId: string,
  actorEmail: string,
  action: ActionType,
  clinicId: string | null,
  clinicName: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    const sb = createAdminClient() as any
    await sb.from('platform_audit_log').insert({
      actor_id:    actorId,
      actor_email: actorEmail,
      action_type: action,
      clinic_id:   clinicId,
      clinic_name: clinicName,
      details,
    })
  } catch {
    // audit log failure must not block the main action
  }
}

export async function extendTrial(clinicId: string, clinicName: string, days: number, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  const newEnd = new Date()
  newEnd.setDate(newEnd.getDate() + days)

  await sb.from('clinics').update({
    subscription_status: 'trialing',
    trial_ends_at: newEnd.toISOString(),
  }).eq('id', clinicId)

  await logPlatformAction(pu.id, pu.email, 'extend_trial', clinicId, clinicName, { days, new_end: newEnd.toISOString() })
  revalidatePath(`/platform/tenants/${clinicId}`)
  redirect(`/platform/tenants/${clinicId}?ok=trial`)
}

export async function suspendTenant(clinicId: string, clinicName: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  await sb.from('clinics').update({ subscription_status: 'cancelled' }).eq('id', clinicId)
  await logPlatformAction(pu.id, pu.email, 'suspend', clinicId, clinicName, {})
  revalidatePath(`/platform/tenants/${clinicId}`)
  redirect(`/platform/tenants/${clinicId}?ok=suspended`)
}

export async function reactivateTenant(clinicId: string, clinicName: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  await sb.from('clinics').update({ subscription_status: 'active' }).eq('id', clinicId)
  await logPlatformAction(pu.id, pu.email, 'reactivate', clinicId, clinicName, {})
  revalidatePath(`/platform/tenants/${clinicId}`)
  redirect(`/platform/tenants/${clinicId}?ok=reactivated`)
}

export async function assignPlan(clinicId: string, clinicName: string, plan: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  await sb.from('clinics').update({ plan }).eq('id', clinicId)
  await logPlatformAction(pu.id, pu.email, 'assign_plan', clinicId, clinicName, { plan })
  revalidatePath(`/platform/tenants/${clinicId}`)
  redirect(`/platform/tenants/${clinicId}?ok=plan`)
}

export async function enterTenant(clinicId: string, clinicName: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()

  await setImpersonatedClinicId(clinicId)
  await setActiveClinicId(clinicId)
  await logPlatformAction(pu.id, pu.email, 'enter_tenant', clinicId, clinicName, {})
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
