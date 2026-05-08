import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'
import { getImpersonatedOrgId } from '@/lib/platform/auth'
import { ClinicProvider } from '@/providers/clinic-provider'
import { NavHeader } from '@/components/nav-header'
import { ImpersonationBar } from '@/components/impersonation-bar'
import { PlanStatusProvider } from '@/context/plan-status'
import { GatingBanner } from '@/components/plan/gating-banner'
import { getFullUsage } from '@/lib/plans/usage'
import { computePlanStatus, type ClinicSubscription } from '@/lib/plans/gating'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const impersonatedOrgId = await getImpersonatedOrgId()

  const sb = createAdminClient() as any
  const { data: profile } = await sb
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single()
  const isPlatformAdmin = !!profile?.platform_role

  if (isPlatformAdmin && !impersonatedOrgId) redirect('/platform')

  const { data: rawMemberships } = await supabase
    .from('org_members')
    .select('role, organizations(id, name, slug, plan, subscription_status, trial_ends_at, current_period_end, industry)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at')

  const memberships = (rawMemberships ?? []) as any[]
  if (memberships.length === 0) redirect('/org-selector')

  const allOrgs = memberships
    .filter((m) => m.organizations !== null)
    .map((m) => ({ ...m.organizations, role: m.role }))

  const context = await getActiveContext()
  const activeOrg = allOrgs.find((o: any) => o.id === context?.organizationId) ?? allOrgs[0]

  if (!context?.organizationId && allOrgs.length > 1) redirect('/org-selector')

  if (activeOrg.subscription_status === 'cancelled') redirect('/blocked')

  const sub: ClinicSubscription = {
    plan: activeOrg.plan ?? 'trial',
    status: activeOrg.subscription_status ?? 'trialing',
    trial_ends_at: activeOrg.trial_ends_at ?? null,
    current_period_end: activeOrg.current_period_end ?? null,
  }

  const usage = await getFullUsage(activeOrg.id)
  const planStatus = computePlanStatus(sub, usage)

  return (
    <ClinicProvider clinic={activeOrg} allClinics={allOrgs}>
      <PlanStatusProvider value={planStatus}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          {impersonatedOrgId && <ImpersonationBar clinicName={activeOrg.name} />}
          <NavHeader user={{ email: user.email! }} />
          <GatingBanner />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </PlanStatusProvider>
    </ClinicProvider>
  )
}
