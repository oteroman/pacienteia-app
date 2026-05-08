import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export interface TenantRow {
  id: string
  name: string
  slug: string
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  memberCount: number
  lastActivity: string | null
}

export interface TenantDetail extends TenantRow {
  members: { id: string; email: string; role: string; full_name: string | null }[]
  recentActivity: { action_type: string; actor_email: string | null; details: Record<string, unknown>; created_at: string }[]
}

export async function fetchAllTenants(): Promise<TenantRow[]> {
  noStore()
  const sb = createAdminClient() as any

  const { data: clinics } = await sb
    .from('clinics')
    .select('id, name, slug, plan, subscription_status, trial_ends_at, current_period_end, created_at')
    .order('created_at', { ascending: false })

  if (!clinics?.length) return []

  // Member counts
  const { data: members } = await sb
    .from('clinic_members')
    .select('clinic_id')

  const countByClinic: Record<string, number> = {}
  for (const m of (members ?? [])) {
    countByClinic[m.clinic_id] = (countByClinic[m.clinic_id] ?? 0) + 1
  }

  // Last activity from workflow_runs
  const { data: runs } = await sb
    .from('workflow_runs')
    .select('clinic_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const lastByClinic: Record<string, string> = {}
  for (const r of (runs ?? [])) {
    if (!lastByClinic[r.clinic_id]) lastByClinic[r.clinic_id] = r.created_at
  }

  return clinics.map((c: any) => ({
    ...c,
    memberCount: countByClinic[c.id] ?? 0,
    lastActivity: lastByClinic[c.id] ?? null,
  }))
}

export async function fetchTenantDetail(clinicId: string): Promise<TenantDetail | null> {
  noStore()
  const sb = createAdminClient() as any

  const { data: clinic } = await sb
    .from('clinics')
    .select('id, name, slug, plan, subscription_status, trial_ends_at, current_period_end, created_at')
    .eq('id', clinicId)
    .single()

  if (!clinic) return null

  // Members with profile info
  const { data: rawMembers } = await sb
    .from('clinic_members')
    .select('role, profiles(id, full_name), user_id')
    .eq('clinic_id', clinicId)

  // Get emails from auth.users via admin API
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailById: Record<string, string> = {}
  for (const u of (users ?? [])) emailById[u.id] = u.email ?? ''

  const members = (rawMembers ?? []).map((m: any) => ({
    id: m.user_id,
    email: emailById[m.user_id] ?? '',
    role: m.role,
    full_name: m.profiles?.full_name ?? null,
  }))

  // Platform audit for this clinic
  const { data: auditRows } = await sb
    .from('platform_audit_log')
    .select('action_type, actor_email, details, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(20)

  return {
    ...clinic,
    memberCount: members.length,
    lastActivity: null,
    members,
    recentActivity: auditRows ?? [],
  }
}
