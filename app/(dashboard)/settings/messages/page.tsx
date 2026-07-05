import { redirect }        from 'next/navigation'
import { createClient }    from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/tenant/context'
import {
  createTemplate,
  deleteTemplate,
  toggleTemplateActive,
} from '@/app/actions/message-templates'
import { TEMPLATE_CATEGORIES } from '@/lib/message-templates/categories'

type Template = {
  id:        string
  name:      string
  body:      string
  category:  string
  is_active: boolean
}

const inputCls    = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300'
const selectCls   = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-300'
const textareaCls = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none'

const CATEGORY_BADGE: Record<string, string> = {
  general:      'bg-[#F3F6F9] text-slate',
  confirmacion: 'bg-lima-100 text-lima-700',
  recordatorio: 'bg-blue-100 text-blue-700',
  seguimiento:  'bg-ai-100 text-ai-600',
  reactivacion: 'bg-orange-100 text-orange-700',
  promocion:    'bg-pink-100 text-pink-700',
}

export default async function MessagesSettingsPage({
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
    .from('message_templates')
    .select('id, name, body, category, is_active')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .order('category')
    .order('name')

  const templates: Template[] = data ?? []
  const active   = templates.filter(t => t.is_active)
  const inactive = templates.filter(t => !t.is_active)

  // Group active templates by category for display
  const byCategory = active.reduce<Record<string, Template[]>>((acc, t) => {
    const cat = t.category ?? 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Plantillas de respuesta</h1>
        <p className="text-sm text-slate mt-1">
          Respuestas rápidas reutilizables para la bandeja de WhatsApp. El staff las elige desde el compositor de mensajes.
        </p>
      </div>

      {saved === '1' && (
        <div className="rounded-xl bg-lima-50 border border-lima-200 px-4 py-3 text-sm text-lima-700 font-medium">
          Plantilla guardada correctamente.
        </div>
      )}

      {/* Active templates grouped by category */}
      <section className="rounded-2xl border bg-white p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-ink">Plantillas activas</h2>
          <p className="text-xs text-slate mt-0.5">
            Aparecen en el selector del compositor de WhatsApp.
          </p>
        </div>

        {active.length === 0 && (
          <p className="text-xs text-slate py-1">
            No hay plantillas activas. Agrega una abajo para empezar.
          </p>
        )}

        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="space-y-2">
            <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">
              {TEMPLATE_CATEGORIES[cat] ?? cat}
            </p>
            {items.map((tmpl) => (
              <div key={tmpl.id} className="flex items-start gap-3 p-3 bg-mist rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-ink">{tmpl.name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[tmpl.category] ?? CATEGORY_BADGE.general}`}>
                      {TEMPLATE_CATEGORIES[tmpl.category] ?? tmpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate mt-1 line-clamp-2 whitespace-pre-wrap">{tmpl.body}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <form action={toggleTemplateActive}>
                    <input type="hidden" name="id" value={tmpl.id} />
                    <input type="hidden" name="is_active" value="true" />
                    <button type="submit" className="text-xs text-slate hover:text-slate px-2 py-1 rounded-lg hover:bg-fog transition-colors">
                      Desactivar
                    </button>
                  </form>
                  <form action={deleteTemplate}>
                    <input type="hidden" name="id" value={tmpl.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Add form */}
        <form action={createTemplate} className="space-y-3 pt-4 border-t border-fog">
          <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">
            Agregar plantilla
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Nombre *</label>
              <input
                name="name"
                type="text"
                required
                placeholder="Ej: Confirmación de cita"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Categoría</label>
              <select name="category" className={selectCls}>
                {Object.entries(TEMPLATE_CATEGORIES).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Mensaje *
              <span className="ml-1 text-[10px] text-slate normal-case font-normal">
                Usa {'{{'} nombre {'}}'}  para el nombre del paciente
              </span>
            </label>
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Ej: Hola {{nombre}}, confirmamos tu cita para mañana a las 10am. ¡Te esperamos!"
              className={textareaCls}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Agregar plantilla
          </button>
        </form>
      </section>

      {/* Inactive templates */}
      {inactive.length > 0 && (
        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Inactivas</h2>
          <div className="space-y-2">
            {inactive.map((tmpl) => (
              <div key={tmpl.id} className="flex items-start gap-3 p-3 bg-mist rounded-xl opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate">{tmpl.name}</p>
                  <p className="text-xs text-slate mt-0.5 line-clamp-1">{tmpl.body}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <form action={toggleTemplateActive}>
                    <input type="hidden" name="id" value={tmpl.id} />
                    <input type="hidden" name="is_active" value="false" />
                    <button type="submit" className="text-xs text-brand-600 hover:text-brand-800 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
                      Reactivar
                    </button>
                  </form>
                  <form action={deleteTemplate}>
                    <input type="hidden" name="id" value={tmpl.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Usage hint */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-xs text-blue-700 font-medium">Cómo usar las plantillas</p>
        <p className="text-xs text-blue-600 mt-1">
          En la bandeja de WhatsApp, dentro del compositor de mensajes, aparece el botón{' '}
          <span className="font-semibold">📋 Plantillas</span>. Al hacer click se despliega la lista
          de plantillas activas. Elige una para copiarla al compositor y edítala antes de enviar.
        </p>
      </div>
    </div>
  )
}
