import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { getImpersonatedClinicId } from '@/lib/platform/auth'
import { ClinicProvider } from '@/providers/clinic-provider'
import { NavHeader } from '@/components/nav-header'
import { ImpersonationBar } from '@/components/impersonation-bar'
import { PlanStatusProvider } from '@/context/plan-status'
import { GatingBanner } from '@/components/plan/gating-banner'
import { getFullUsage } from '@/lib/plans/usage'
import { computePlanStatus, type ClinicSubscription } from '@/lib/plans/gating'
import type { ActiveClinic } from '@/providers/clinic-provider'
import type { Clinic, ClinicRole } from '@/types/database'

interface MembershipRow {
  role: string
  clinics: Clinic | null
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if this is a platform admin in impersonation mode
  const impersonatedClinicId = await getImpersonatedClinicId()

  // Check platform_role — platform admins without impersonation go to /platform
  const sb = createAdminClient() as any
  const { data: profile } = await sb
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single()
  const isPlatformAdmin = !!profile?.platform_role

  if (isPlatformAdmin && !impersonatedClinicId) redirect('/platform')

  // Fetch all clinics the user belongs to (clinics nested to avoid extra round-trip)
  const { data: rawMemberships } = await supabase
    .from('clinic_members')
    .select('role, clinics(*)')
    .eq('user_id', user.id)
    .order('created_at')

  const memberships = (rawMemberships ?? []) as unknown as MembershipRow[]

  if (memberships.length === 0) redirect('/clinic-selector')

  const allClinics: ActiveClinic[] = memberships
    .filter((m): m is MembershipRow & { clinics: Clinic } => m.clinics !== null)
    .map((m) => ({ ...m.clinics, role: m.role as ClinicRole }))

  const activeClinicId = await getActiveClinicId()
  const activeClinic = allClinics.find((c) => c.id === activeClinicId) ?? allClinics[0]

  if (!activeClinicId && allClinics.length > 1) redirect('/clinic-selector')

  // Cancelled accounts get a full-page block — no dashboard access
  if (activeClinic.subscription_status === 'cancelled') redirect('/blocked')

  // Build ClinicSubscription from the already-loaded clinic row (no extra DB call)
  const sub: ClinicSubscription = {
    plan: activeClinic.plan ?? 'trial',
    status: activeClinic.subscription_status ?? 'trialing',
    trial_ends_at: activeClinic.trial_ends_at ?? null,
    current_period_end: activeClinic.current_period_end ?? null,
  }

  // Load usage counts and compute full plan status
  const usage = await getFullUsage(activeClinic.id)
  const planStatus = computePlanStatus(sub, usage)

  return (
    <ClinicProvider clinic={activeClinic} allClinics={allClinics}>
      <PlanStatusProvider value={planStatus}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          {impersonatedClinicId && <ImpersonationBar clinicName={activeClinic.name} />}
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
