import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/tenant/context'
import { createService, toggleServiceActive, deleteService } from '@/app/actions/services'

type Service = {
  id:               string
  name:             string
  price:            number | null
  duration_min:     number | null
  retreatment_days: number | null
  is_active:        boolean
}

const inputCls = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300'

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const { saved } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId, branchId } = ctx

  const { data } = await (supabase as any)
    .from('services')
    .select('id, name, price, duration_min, retreatment_days, is_active')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .order('name')

  const services: Service[] = data ?? []
  const active   = services.filter(s => s.is_active)
  const inactive = services.filter(s => !s.is_active)

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Servicios y tratamientos</h1>
        <p className="text-sm text-slate mt-1">
          Catálogo de servicios con precio base. Aparecen en el formulario de citas.
        </p>
      </div>

      {saved === '1' && (
        <div className="rounded-xl bg-lima-50 border border-lima-200 px-4 py-3 text-sm text-lima-700 font-medium">
          Guardado correctamente.
        </div>
      )}

      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Activos</h2>
          <p className="text-xs text-slate mt-0.5">
            Aparecen en el selector de tratamiento al crear una cita.
          </p>
        </div>

        {active.length > 0 ? (
          <div className="space-y-2">
            {active.map((svc) => (
              <div key={svc.id} className="flex items-center gap-3 p-3 bg-mist rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{svc.name}</p>
                  <p className="text-xs text-slate mt-0.5 flex flex-wrap gap-2">
                    {svc.price != null && <span>S/ {Number(svc.price).toFixed(0)}</span>}
                    {svc.duration_min != null && <span>{svc.duration_min} min</span>}
                    {svc.retreatment_days != null && (
                      <span className="text-lima-600">Ciclo: {svc.retreatment_days}d</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <form action={toggleServiceActive}>
                    <input type="hidden" name="id" value={svc.id} />
                    <input type="hidden" name="is_active" value="true" />
                    <button type="submit" className="text-xs text-slate hover:text-slate px-2 py-1 rounded-lg hover:bg-fog transition-colors">
                      Desactivar
                    </button>
                  </form>
                  <form action={deleteService}>
                    <input type="hidden" name="id" value={svc.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate py-1">No hay servicios activos. Agrega uno abajo.</p>
        )}

        {/* Add form */}
        <form action={createService} className="space-y-3 pt-4 border-t border-fog">
          <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">Agregar servicio</p>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Nombre *</label>
            <input name="name" type="text" required placeholder="Ej: Botox frente, Limpieza facial, Consulta" className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Precio base (S/)</label>
              <input name="price" type="number" min="0" step="0.50" placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Duración (min)</label>
              <input name="duration_min" type="number" min="5" step="5" placeholder="30" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Ciclo (días)
                <span className="ml-1 text-[10px] text-slate normal-case font-normal">oportunidades IA</span>
              </label>
              <input name="retreatment_days" type="number" min="1" step="1" placeholder="Ej: 90" className={inputCls} />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Agregar servicio
          </button>
        </form>
      </section>

      {inactive.length > 0 && (
        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Inactivos</h2>
          <div className="space-y-2">
            {inactive.map((svc) => (
              <div key={svc.id} className="flex items-center gap-3 p-3 bg-mist rounded-xl opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate">{svc.name}</p>
                  {svc.price != null && (
                    <p className="text-xs text-slate">S/ {Number(svc.price).toFixed(0)}</p>
                  )}
                </div>
                <form action={toggleServiceActive}>
                  <input type="hidden" name="id" value={svc.id} />
                  <input type="hidden" name="is_active" value="false" />
                  <button type="submit" className="text-xs text-brand-600 hover:text-brand-800 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
                    Reactivar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
