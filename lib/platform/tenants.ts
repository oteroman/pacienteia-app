import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CrmNote {
  id:           string
  author_email: string
  contact_type: string
  body:         string
  created_at:   string
}

export interface TenantRow {
  id:                  string
  name:                string
  slug:                string
  plan:                string | null
  subscription_status: string | null
  trial_ends_at:       string | null
  current_period_end:  string | null
  created_at:          string
  memberCount:         number
  lastActivity:        string | null
  acquisition_source:  string | null
  acquisition_rep_id:  string | null
  lastCrmContact:      string | null
}

export interface WhatsAppConfigRow {
  id:              string
  branch_id:       string
  branch_name:     string
  display_name:    string | null
  phone_number_id: string
  waba_id:         string
  status:          string
  has_app_secret:  boolean
  created_at:      string
}

export interface BranchRow {
  id:   string
  name: string
}

export interface OnboardingStep {
  key:   string
  label: string
  done:  boolean
  hint:  string   // what to do if not done
}

export interface TenantDetail extends TenantRow {
  members:         { id: string; email: string; role: string; full_name: string | null }[]
  branches:        BranchRow[]
  whatsappConfigs: WhatsAppConfigRow[]
  crmNotes:        CrmNote[]
  recentActivity:  { action_type: string; actor_email: string | null; details: Record<string, unknown>; created_at: string }[]
  onboarding:      OnboardingStep[]
}

export async function fetchAllTenants(): Promise<TenantRow[]> {
  noStore()
  const sb = createAdminClient() as any

  const { data: orgs } = await sb
    .from('organizations')
    .select('id, name, slug, plan, subscription_status, trial_ends_at, current_period_end, created_at, acquisition_source, acquisition_rep_id')
    .order('created_at', { ascending: false })

  if (!orgs?.length) return []

  const [{ data: members }, { data: auditRows }, { data: crmRows }] = await Promise.all([
    sb.from('org_members').select('organization_id'),
    sb.from('platform_audit_log')
      .select('organization_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    sb.from('platform_crm_notes')
      .select('organization_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const countByOrg: Record<string, number> = {}
  for (const m of (members ?? [])) {
    countByOrg[m.organization_id] = (countByOrg[m.organization_id] ?? 0) + 1
  }

  const lastByOrg: Record<string, string> = {}
  for (const r of (auditRows ?? [])) {
    if (r.organization_id && !lastByOrg[r.organization_id]) {
      lastByOrg[r.organization_id] = r.created_at
    }
  }

  const lastCrmByOrg: Record<string, string> = {}
  for (const r of (crmRows ?? [])) {
    if (r.organization_id && !lastCrmByOrg[r.organization_id]) {
      lastCrmByOrg[r.organization_id] = r.created_at
    }
  }

  return orgs.map((o: any) => ({
    ...o,
    memberCount:        countByOrg[o.id] ?? 0,
    lastActivity:       lastByOrg[o.id] ?? null,
    lastCrmContact:     lastCrmByOrg[o.id] ?? null,
    acquisition_source: o.acquisition_source ?? null,
    acquisition_rep_id: o.acquisition_rep_id ?? null,
  }))
}

export async function fetchTenantDetail(orgId: string): Promise<TenantDetail | null> {
  noStore()
  const sb = createAdminClient() as any

  const { data: org } = await sb
    .from('organizations')
    .select('id, name, slug, plan, subscription_status, trial_ends_at, current_period_end, created_at, acquisition_source, acquisition_rep_id')
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

  const { data: rawBranches } = await sb
    .from('branches')
    .select('id, name')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const branches: BranchRow[] = (rawBranches ?? []).map((b: any) => ({ id: b.id, name: b.name }))
  const branchNameById: Record<string, string> = {}
  for (const b of branches) branchNameById[b.id] = b.name

  const { data: rawWaConfigs } = await sb
    .from('branch_whatsapp_config')
    .select('id, branch_id, display_name, phone_number_id, waba_id, status, app_secret_enc, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  const whatsappConfigs: WhatsAppConfigRow[] = (rawWaConfigs ?? []).map((c: any) => ({
    id:              c.id,
    branch_id:       c.branch_id,
    branch_name:     branchNameById[c.branch_id] ?? '—',
    display_name:    c.display_name,
    phone_number_id: c.phone_number_id,
    waba_id:         c.waba_id,
    status:          c.status,
    has_app_secret:  !!c.app_secret_enc,
    created_at:      c.created_at,
  }))

  const [{ data: auditRows }, { data: rawCrmNotes }, aptCount, reminderCount, professionalCount, reacCount] = await Promise.all([
    sb.from('platform_audit_log')
      .select('action_type, actor_email, details, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('platform_crm_notes')
      .select('id, author_email, contact_type, body, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
    sb.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .limit(1),
    sb.from('appointment_reminders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .limit(1),
    sb.from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1),
    sb.from('reactivation_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .limit(1),
  ])

  const crmNotes: CrmNote[] = rawCrmNotes ?? []

  const hasWhatsApp     = whatsappConfigs.some((c) => c.status === 'active')
  const hasProfessional = (professionalCount.count ?? 0) > 0
  const hasAppointment  = (aptCount.count ?? 0) > 0
  const hasReminder     = (reminderCount.count ?? 0) > 0
  const hasReactivation = (reacCount.count ?? 0) > 0

  const onboarding: OnboardingStep[] = [
    {
      key:   'whatsapp',
      label: 'WhatsApp conectado',
      done:  hasWhatsApp,
      hint:  'Conecta un número en la sección WhatsApp Business abajo',
    },
    {
      key:   'professional',
      label: 'Primer profesional creado',
      done:  hasProfessional,
      hint:  'Entrar al tenant → Ajustes → Profesionales',
    },
    {
      key:   'appointment',
      label: 'Primera cita agendada',
      done:  hasAppointment,
      hint:  'Entrar al tenant → Citas → Nueva cita',
    },
    {
      key:   'reminder',
      label: 'Primer recordatorio enviado',
      done:  hasReminder,
      hint:  'Se envía automáticamente 24h antes de la primera cita confirmada',
    },
    {
      key:   'reactivation',
      label: 'Campaña de reactivación activa',
      done:  hasReactivation,
      hint:  'Se activa automáticamente cuando hay pacientes inactivos >90 días',
    },
  ]

  return {
    ...org,
    memberCount:        members.length,
    lastActivity:       null,
    lastCrmContact:     crmNotes[0]?.created_at ?? null,
    acquisition_source: org.acquisition_source ?? null,
    members,
    branches,
    whatsappConfigs,
    crmNotes,
    recentActivity: auditRows ?? [],
    onboarding,
  }
}
