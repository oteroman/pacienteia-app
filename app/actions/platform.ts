'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin, setImpersonatedOrgId, clearImpersonation } from '@/lib/platform/auth'
import { setActiveContext } from '@/lib/tenant/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptToken } from '@/lib/crypto/whatsapp-token'

type ActionType = 'extend_trial' | 'suspend' | 'reactivate' | 'assign_plan' | 'enter_tenant' | 'exit_tenant' | 'create_tenant' | 'whatsapp_add' | 'whatsapp_revoke' | 'crm_note' | 'update_source'

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

export async function createTenant(formData: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  const orgName    = (formData.get('org_name') as string ?? '').trim()
  const branchName = (formData.get('branch_name') as string ?? '').trim() || orgName
  const ownerEmail = (formData.get('owner_email') as string ?? '').trim().toLowerCase()
  const plan       = (formData.get('plan') as string) || 'trial'
  const trialDays  = parseInt(formData.get('trial_days') as string || '14', 10)
  const prospectId = (formData.get('prospect_id') as string || '').trim() || null

  if (!orgName || !ownerEmail) return

  const slug = orgName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + trialDays)

  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .insert({ name: orgName, slug, plan, subscription_status: 'trialing', trial_ends_at: trialEnd.toISOString() })
    .select('id')
    .single()

  if (orgErr || !org) {
    console.error('[createTenant] org insert:', orgErr?.message)
    return
  }

  const { data: branch } = await sb
    .from('branches')
    .insert({ organization_id: org.id, name: branchName })
    .select('id')
    .single()

  const { data: { user: existing } } = await sb.auth.admin.getUserByEmail(ownerEmail)
  let userId: string

  if (existing) {
    userId = existing.id
  } else {
    const { data: invited, error: invErr } = await sb.auth.admin.inviteUserByEmail(ownerEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.pacienteia.com'}/auth/callback`,
    })
    if (invErr || !invited?.user) {
      console.error('[createTenant] invite:', invErr?.message)
      return
    }
    userId = invited.user.id
  }

  await sb.from('org_members').upsert(
    { organization_id: org.id, branch_id: branch?.id ?? null, user_id: userId, role: 'owner', status: 'active' },
    { onConflict: 'organization_id,user_id' },
  )

  if (prospectId) {
    await sb.from('sales_prospects').update({ status: 'converted' }).eq('id', prospectId)
  }

  await logPlatformAction(pu.id, pu.email, 'create_tenant', org.id, orgName, {
    plan, trial_days: trialDays, owner_email: ownerEmail, branch_name: branchName,
  })

  revalidatePath('/platform/tenants')
  revalidatePath('/platform/sales')
  redirect(`/platform/tenants/${org.id}?ok=created`)
}

export async function addWhatsAppConfig(orgId: string, orgName: string, formData: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  const branchId      = (formData.get('branch_id')       as string ?? '').trim()
  const displayName   = (formData.get('display_name')    as string ?? '').trim()
  const phoneNumberId = (formData.get('phone_number_id') as string ?? '').trim()
  const wabaId        = (formData.get('waba_id')         as string ?? '').trim()
  const accessToken   = (formData.get('access_token')    as string ?? '').trim()
  const appSecret     = (formData.get('app_secret')      as string ?? '').trim()

  if (!branchId || !phoneNumberId || !wabaId || !accessToken) return

  const accessTokenEnc = encryptToken(accessToken)
  const appSecretEnc   = appSecret ? encryptToken(appSecret) : null

  const { error } = await sb.from('branch_whatsapp_config').insert({
    organization_id:  orgId,
    branch_id:        branchId,
    display_name:     displayName || null,
    phone_number_id:  phoneNumberId,
    waba_id:          wabaId,
    access_token_enc: accessTokenEnc,
    app_secret_enc:   appSecretEnc,
    status:           'active',
    connected_at:     new Date().toISOString(),
  })

  if (error) {
    console.error('[addWhatsAppConfig]', error.message)
    redirect(`/platform/tenants/${orgId}?err=wa_duplicate`)
  }

  await logPlatformAction(pu.id, pu.email, 'whatsapp_add', orgId, orgName, {
    phone_number_id: phoneNumberId, branch_id: branchId,
  })
  revalidatePath(`/platform/tenants/${orgId}`)
  redirect(`/platform/tenants/${orgId}?ok=whatsapp_added`)
}

export async function updateAcquisitionSource(orgId: string, orgName: string, formData: FormData) {
  const pu     = await requirePlatformAdmin()
  const sb     = createAdminClient() as any
  const source = (formData.get('acquisition_source') as string ?? '').trim() || null

  await sb.from('organizations').update({ acquisition_source: source }).eq('id', orgId)
  await logPlatformAction(pu.id, pu.email, 'update_source', orgId, orgName, { source })
  revalidatePath(`/platform/tenants/${orgId}`)
  revalidatePath('/platform/tenants')
}

export async function addCrmNote(orgId: string, orgName: string, formData: FormData) {
  const pu          = await requirePlatformAdmin()
  const sb          = createAdminClient() as any
  const body        = (formData.get('body')         as string ?? '').trim()
  const contactType = (formData.get('contact_type') as string ?? 'note').trim()

  if (!body) return

  await sb.from('platform_crm_notes').insert({
    organization_id: orgId,
    author_email:    pu.email,
    contact_type:    contactType,
    body,
  })
  await logPlatformAction(pu.id, pu.email, 'crm_note', orgId, orgName, { contact_type: contactType })
  revalidatePath(`/platform/tenants/${orgId}`)
  revalidatePath('/platform/tenants')
}

export async function revokeWhatsAppConfig(configId: string, orgId: string, orgName: string, _fd: FormData) {
  const pu = await requirePlatformAdmin()
  const sb = createAdminClient() as any

  await sb.from('branch_whatsapp_config').update({ status: 'revoked' }).eq('id', configId)
  await logPlatformAction(pu.id, pu.email, 'whatsapp_revoke', orgId, orgName, { config_id: configId })
  revalidatePath(`/platform/tenants/${orgId}`)
  redirect(`/platform/tenants/${orgId}?ok=whatsapp_revoked`)
}
