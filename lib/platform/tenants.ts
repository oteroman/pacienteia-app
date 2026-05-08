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

  const { data: orgs } = await sb
    .from('organizations')
    .select('id, name, slug, plan, subscription_status, trial_ends_at, current_period_end, created_at')
    .order('created_at', { ascending: false })

  if (!orgs?.length) return []

  const { data: members } = await sb
    .from('org_members')
    .select('organization_id')

  const countByOrg: Record<string, number> = {}
  for (const m of (members ?? [])) {
    countByOrg[m.organization_id] = (countByOrg[m.organization_id] ?? 0) + 1
  }

  const { data: auditRows } = await sb
    .from('platform_audit_log')
    .select('organization_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const lastByOrg: Record<string, string> = {}
  for (const r of (auditRows ?? [])) {
    if (r.organization_id && !lastByOrg[r.organization_id]) {
      lastByOrg[r.organization_id] = r.created_at
    }
  }

  return orgs.map((o: any) => ({
    ...o,
    memberCount: countByOrg[o.id] ?? 0,
    lastActivity: lastByOrg[o.id] ?? null,
  }))
}

export async function fetchTenantDetail(orgId: string): Promise<TenantDetail | null> {
  noStore()
  const sb = createAdminClient() as any

  const { data: org } = await sb
    .from('organizations')
    .select('id, name, slug, plan, subscription_status, trial_ends_at, current_period_end, created_at')
    .eq('id', orgId)
    .single()

  if (!org) return null

  const { data: rawMembers } = await sb
    .from('org_members')
    .select('role, profiles(id, full_name), user_id')
    .eq('organization_id', orgId)
    .eq('status', 'active')

  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailById: Record<string, string> = {}
  for (const u of (users ?? [])) emailById[u.id] = u.email ?? ''

  const members = (rawMembers ?? []).map((m: any) => ({
    id: m.user_id,
    email: emailById[m.user_id] ?? '',
    role: m.role,
    full_name: m.profiles?.full_name ?? null,
  }))

  const { data: auditRows } = await sb
    .from('platform_audit_log')
    .select('action_type, actor_email, details, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20)

  return {
    ...org,
    memberCount: members.length,
    lastActivity: null,
    members,
    recentActivity: auditRows ?? [],
  }
}
