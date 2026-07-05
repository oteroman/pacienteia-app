import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setActiveContext } from '@/lib/tenant/context'

const INDUSTRY_LABELS: Record<string, string> = {
  estetica:   'Clínica Estética',
  dental:     'Clínica Dental',
  psicologia: 'Consultorio Psicológico',
  medicina:   'Consultorio Médico',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  staff: 'Staff',
}

async function selectContext(organizationId: string, branchId: string) {
  'use server'
  await setActiveContext(organizationId, branchId)
  redirect('/dashboard')
}

export default async function OrgSelectorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const pick = (await searchParams).pick
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Platform admins should never land here
  const sb = createAdminClient() as any
  const { data: profile } = await sb
    .from('profiles').select('platform_role').eq('id', user.id).single()
  if (profile?.platform_role) redirect('/platform')

  const { data: memberships } = await supabase
    .from('org_members')
    .select(`
      role,
      organization_id,
      organizations (
        id, name, slug, industry, plan, subscription_status,
        onboarding_status,
        branches (id, name, city, address)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (!memberships || memberships.length === 0) {
    redirect('/onboarding')
  }

  // Auto-forward single-org/single-branch users straight to the dashboard.
  // The context cookie is set by the /org-selector/auto Route Handler (cookies
  // cannot be written during a Server Component render in Next 15). ?pick=1
  // disables the auto-forward so a validation failure can't cause a loop.
  if (memberships.length === 1) {
    const m   = memberships[0] as any
    const org = m.organizations
    const branches: any[] = org?.branches ?? []

    if (org?.onboarding_status !== 'first_flow_active') {
      redirect('/onboarding/resume')
    }

    if (branches.length === 1 && pick !== '1') {
      redirect(`/org-selector/auto?org=${org.id}&branch=${branches[0].id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Selecciona tu organización</h1>
          <p className="text-sm text-gray-400 mt-1">Elige la clínica y sucursal con la que quieres trabajar</p>
        </div>

        <div className="space-y-3">
          {(memberships as any[]).map((m) => {
            const org      = m.organizations
            const branches = org?.branches ?? []
            const industry = INDUSTRY_LABELS[org?.industry] ?? org?.industry
            const role     = ROLE_LABELS[m.role] ?? m.role

            return (
              <div key={org?.id} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{org?.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{industry} · {role}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase
                      ${org?.subscription_status === 'active'
                        ? 'bg-green-900 text-green-300 border-green-800'
                        : 'bg-blue-900 text-blue-300 border-blue-800'}`}>
                      {org?.subscription_status === 'active' ? 'Activa' : 'Trial'}
                    </span>
                  </div>
                </div>

                {branches.length === 0 ? (
                  <div className="px-5 py-3 text-sm text-gray-500">Sin sucursales configuradas</div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {branches.map((branch: any) => {
                      const action = selectContext.bind(null, org.id, branch.id)
                      return (
                        <form key={branch.id} action={action}>
                          <button
                            type="submit"
                            className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors text-left"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">{branch.name}</p>
                              {branch.city && (
                                <p className="text-xs text-gray-500">{branch.city}</p>
                              )}
                            </div>
                            <span className="text-gray-600 text-sm">→</span>
                          </button>
                        </form>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-600">
          ¿Necesitas acceso a otra organización?{' '}
          <a href="mailto:soporte@pacienteia.com" className="text-blue-400 hover:underline">
            Contacta a soporte
          </a>
        </p>
      </div>
    </div>
  )
}
