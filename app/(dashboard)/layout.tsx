import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { ClinicProvider } from '@/providers/clinic-provider'
import { NavHeader } from '@/components/nav-header'
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

  // Fetch all clinics the user belongs to
  const { data: rawMemberships } = await supabase
    .from('clinic_members')
    .select('role, clinics(*)')
    .eq('user_id', user.id)
    .order('created_at')

  const memberships = (rawMemberships ?? []) as unknown as MembershipRow[]

  if (memberships.length === 0) {
    redirect('/clinic-selector')
  }

  const allClinics: ActiveClinic[] = memberships
    .filter((m): m is MembershipRow & { clinics: Clinic } => m.clinics !== null)
    .map((m) => ({
      ...m.clinics,
      role: m.role as ClinicRole,
    }))

  // Determine active clinic from cookie, or auto-select first
  const activeClinicId = await getActiveClinicId()
  const activeClinic = allClinics.find((c) => c.id === activeClinicId) ?? allClinics[0]

  // If user has multiple clinics but no cookie set, send to selector
  if (!activeClinicId && allClinics.length > 1) {
    redirect('/clinic-selector')
  }

  return (
    <ClinicProvider clinic={activeClinic} allClinics={allClinics}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavHeader user={{ email: user.email! }} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </ClinicProvider>
  )
}
