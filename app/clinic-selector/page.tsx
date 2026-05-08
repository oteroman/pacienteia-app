import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setActiveClinicId } from '@/lib/tenant/active-clinic'
import type { Clinic, ClinicRole } from '@/types/database'

interface MembershipRow {
  role: string
  clinics: Clinic | null
}

async function selectClinic(formData: FormData) {
  'use server'
  const clinicId = formData.get('clinic_id') as string
  await setActiveClinicId(clinicId)
  redirect('/dashboard')
}

export default async function ClinicSelectorPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Platform admins never land here — send them to their console
  const sb = createAdminClient() as any
  const { data: profile } = await sb.from('profiles').select('platform_role').eq('id', user.id).single()
  if (profile?.platform_role) redirect('/platform')

  const { data: rawMemberships } = await supabase
    .from('clinic_members')
    .select('role, clinics(*)')
    .eq('user_id', user.id)
    .order('created_at')

  const memberships = (rawMemberships ?? []) as unknown as MembershipRow[]

  if (memberships.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-800">Sin clínicas asignadas</h1>
          <p className="mt-2 text-sm text-gray-500">
            Tu cuenta no está asociada a ninguna clínica. Contacta al administrador.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-700">Paciente IA</h1>
          <p className="mt-1 text-sm text-gray-500">
            Selecciona la clínica con la que quieres trabajar
          </p>
        </div>

        <div className="space-y-3">
          {memberships.map((m) => {
            const clinic = m.clinics
            if (!clinic) return null

            return (
              <form key={clinic.id} action={selectClinic}>
                <input type="hidden" name="clinic_id" value={clinic.id} />
                <button
                  type="submit"
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm
                             px-5 py-4 hover:border-brand-500 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
                        {clinic.name}
                      </p>
                      {clinic.address && (
                        <p className="text-sm text-gray-400 mt-0.5">{clinic.address}</p>
                      )}
                    </div>
                    <RoleBadge role={m.role as ClinicRole} />
                  </div>
                </button>
              </form>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function RoleBadge({ role }: { role: ClinicRole }) {
  const styles: Record<ClinicRole, string> = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-brand-100 text-brand-700',
    staff: 'bg-gray-100 text-gray-600',
  }
  const labels: Record<ClinicRole, string> = {
    owner: 'Propietario',
    admin: 'Administrador',
    staff: 'Staff',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[role]}`}>
      {labels[role]}
    </span>
  )
}
