import { redirect }          from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { isFeatureAllowed }  from '@/lib/plans/gating'
import Link                  from 'next/link'
import { createBranch, updateBranch, switchBranch, deleteBranch } from '@/app/actions/branches'

interface Branch {
  id:         string
  name:       string
  phone:      string | null
  address:    string | null
  city:       string
  created_at: string
}

export default async function BranchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')

  const sb = createAdminClient() as any

  const { data: branches } = await sb
    .from('branches')
    .select('id, name, phone, address, city, created_at')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('created_at')

  const list = (branches ?? []) as Branch[]
  const canMultiBranch = await isFeatureAllowed(ctx.organizationId, 'multi_branch')
  const activeBranchId = ctx.branchId

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sucursales</h1>
          <p className="text-sm text-slate mt-1">
            Gestiona las sedes de tu clínica. Cada sucursal tiene su propia agenda, WhatsApp y equipo.
          </p>
        </div>
        {!canMultiBranch && (
          <Link
            href="/pricing"
            className="text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
          >
            Premium para múltiples sucursales
          </Link>
        )}
      </div>

      {/* Branch list */}
      <div className="space-y-3">
        {list.map((branch) => {
          const isActive = branch.id === activeBranchId
          const switchAction = switchBranch.bind(null, branch.id)
          const deleteAction = deleteBranch.bind(null, branch.id)
          const updateAction = updateBranch.bind(null, branch.id)

          return (
            <details key={branch.id} className={`group rounded-2xl border bg-white ${isActive ? 'border-brand-300 ring-1 ring-brand-200' : 'border-fog'}`}>
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-brand-500' : 'bg-fog'}`} />
                  <div>
                    <p className="font-semibold text-ink text-sm">{branch.name}</p>
                    {branch.address && (
                      <p className="text-xs text-slate">{branch.address}{branch.city ? `, ${branch.city}` : ''}</p>
                    )}
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-bold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-100">
                      Activa
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <form action={switchAction}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-brand-600 hover:text-brand-800 border border-brand-200 hover:border-brand-400 px-3 py-1 rounded-lg transition-colors"
                      >
                        Cambiar aquí
                      </button>
                    </form>
                  )}
                  <span className="text-slate group-open:rotate-180 transition-transform text-xs">▼</span>
                </div>
              </summary>

              {/* Edit form inside details */}
              <div className="px-5 pb-5 pt-1 border-t border-fog space-y-4">
                <form action={updateAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate">Nombre de la sucursal *</label>
                    <input
                      name="name"
                      defaultValue={branch.name}
                      required
                      className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate">Teléfono</label>
                    <input
                      name="phone"
                      defaultValue={branch.phone ?? ''}
                      className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate">Dirección</label>
                    <input
                      name="address"
                      defaultValue={branch.address ?? ''}
                      className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate">Ciudad</label>
                    <input
                      name="city"
                      defaultValue={branch.city}
                      className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <button
                      type="submit"
                      className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Guardar cambios
                    </button>
                    {!isActive && list.length > 1 && (
                      <form action={deleteAction}>
                        <button
                          type="submit"
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          onClick={(e) => { if (!confirm('¿Eliminar esta sucursal?')) e.preventDefault() }}
                        >
                          Eliminar sucursal
                        </button>
                      </form>
                    )}
                  </div>
                </form>
              </div>
            </details>
          )
        })}
      </div>

      {/* Add new branch */}
      {canMultiBranch ? (
        <div className="rounded-2xl border border-dashed border-fog bg-white p-6 space-y-4">
          <h2 className="font-semibold text-ink text-sm">Agregar sucursal</h2>
          <form action={createBranch} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate">Nombre *</label>
              <input
                name="name"
                required
                placeholder="Ej: Sede Miraflores"
                className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate">Teléfono</label>
              <input
                name="phone"
                placeholder="01 234 5678"
                className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate">Dirección</label>
              <input
                name="address"
                placeholder="Av. Principal 123, Miraflores"
                className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate">Ciudad</label>
              <input
                name="city"
                defaultValue="Lima"
                className="w-full text-sm border border-fog rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="text-sm font-medium bg-ink hover:bg-gray-800 text-white px-5 py-2 rounded-lg transition-colors"
              >
                + Agregar sucursal
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-fog bg-mist p-6 text-center space-y-3">
          <p className="text-sm font-medium text-slate">¿Tienes más de una sede?</p>
          <p className="text-xs text-slate max-w-sm mx-auto">
            El plan Premium incluye sucursales ilimitadas, cada una con su propia agenda, WhatsApp y equipo.
          </p>
          <Link
            href="/pricing"
            className="inline-block text-sm font-semibold bg-purple-700 hover:bg-purple-800 text-white px-5 py-2.5 rounded-xl transition-colors"
          >
            Ver plan Premium →
          </Link>
        </div>
      )}

      {/* Note about WhatsApp per branch */}
      {canMultiBranch && list.length > 1 && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-xs text-brand-800 space-y-1">
          <p className="font-semibold">Configura WhatsApp para cada sucursal</p>
          <p>
            Cada sucursal necesita su propio número de WhatsApp Business.{' '}
            <Link href="/settings/whatsapp" className="underline">Configurar WhatsApp →</Link>
          </p>
        </div>
      )}
    </div>
  )
}
