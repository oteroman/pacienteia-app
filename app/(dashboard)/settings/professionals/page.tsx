import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/tenant/context'
import {
  createProfessional,
  toggleProfessionalActive,
  deleteProfessional,
} from '@/app/actions/professionals'

type Professional = {
  id:          string
  name:        string
  specialty:   string | null
  color:       string
  is_active:   boolean
}

const inputCls = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300'

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
]

export default async function ProfessionalsPage({
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

  const { data: professionals } = await (supabase as any)
    .from('professionals')
    .select('id, name, specialty, color, is_active')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .order('name')

  const pros: Professional[] = professionals ?? []
  const active   = pros.filter(p => p.is_active)
  const inactive = pros.filter(p => !p.is_active)

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Profesionales</h1>
        <p className="text-sm text-slate mt-1">
          Doctores, terapeutas y especialistas de esta sede.
        </p>
      </div>

      {saved === '1' && (
        <div className="rounded-xl bg-lima-50 border border-lima-200 px-4 py-3 text-sm text-lima-700 font-medium">
          Guardado correctamente.
        </div>
      )}

      {/* Active professionals */}
      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Activos</h2>
          <p className="text-xs text-slate mt-0.5">
            Aparecen en el formulario de citas para asignar profesional.
          </p>
        </div>

        {active.length > 0 ? (
          <div className="space-y-2">
            {active.map((pro) => (
              <div key={pro.id} className="flex items-center gap-3 p-3 bg-mist rounded-xl">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: pro.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{pro.name}</p>
                  {pro.specialty && (
                    <p className="text-xs text-slate">{pro.specialty}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <form action={toggleProfessionalActive}>
                    <input type="hidden" name="id" value={pro.id} />
                    <input type="hidden" name="is_active" value="true" />
                    <button type="submit" className="text-xs text-slate hover:text-slate px-2 py-1 rounded-lg hover:bg-fog transition-colors">
                      Desactivar
                    </button>
                  </form>
                  <form action={deleteProfessional}>
                    <input type="hidden" name="id" value={pro.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate py-1">No hay profesionales activos. Agrega uno abajo.</p>
        )}

        {/* Add form */}
        <form action={createProfessional} className="space-y-3 pt-4 border-t border-fog">
          <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">Agregar profesional</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Nombre *</label>
              <input name="name" type="text" required placeholder="Dra. García" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Especialidad</label>
              <input name="specialty" type="text" placeholder="Medicina estética" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-2">Color en agenda</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c, i) => (
                <label key={c} className="cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    defaultChecked={i === 0}
                    className="sr-only peer"
                  />
                  <span
                    className="block w-7 h-7 rounded-full border-2 border-transparent peer-checked:border-gray-800 transition-all"
                    style={{ backgroundColor: c }}
                  />
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Agregar profesional
          </button>
        </form>
      </section>

      {/* Inactive professionals */}
      {inactive.length > 0 && (
        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Inactivos</h2>
          <div className="space-y-2">
            {inactive.map((pro) => (
              <div key={pro.id} className="flex items-center gap-3 p-3 bg-mist rounded-xl opacity-60">
                <span
                  className="w-3 h-3 rounded-full shrink-0 grayscale"
                  style={{ backgroundColor: pro.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate">{pro.name}</p>
                  {pro.specialty && (
                    <p className="text-xs text-slate">{pro.specialty}</p>
                  )}
                </div>
                <form action={toggleProfessionalActive}>
                  <input type="hidden" name="id" value={pro.id} />
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
