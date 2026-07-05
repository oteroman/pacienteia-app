import { redirect }           from 'next/navigation'
import { createClient }       from '@/lib/supabase/server'
import { getActiveContext }   from '@/lib/tenant/context'
import { toggleAutomation }   from '@/app/actions/automation-settings'
import { AUTOMATION_LABELS, type AutomationKey } from '@/lib/automation/settings'

const AUTOMATION_GROUPS: { label: string; keys: AutomationKey[] }[] = [
  {
    label: 'Recordatorios de citas',
    keys: ['reminders_24h', 'reminders_2h', 'smart_buffer'],
  },
  {
    label: 'Retención y reactivación',
    keys: ['appointment_followups', 'reactivation', 'reschedule_escalation'],
  },
  {
    label: 'Revenue y crecimiento',
    keys: ['flash_offers', 'roi_report'],
  },
]

export default async function AutomationsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId, branchId } = ctx

  const { data } = await (supabase as any)
    .from('automation_settings')
    .select('automation_key, is_enabled')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)

  const settingsMap = new Map<string, boolean>(
    ((data ?? []) as { automation_key: string; is_enabled: boolean }[])
      .map((r) => [r.automation_key, r.is_enabled])
  )

  function isEnabled(key: AutomationKey): boolean {
    return settingsMap.has(key) ? settingsMap.get(key)! : true
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Automatizaciones</h1>
        <p className="text-sm text-slate mt-1">
          Activa o pausa cada flujo automático sin tocar n8n. Los cambios aplican en el próximo ciclo del CRON.
        </p>
      </div>

      {AUTOMATION_GROUPS.map((group) => (
        <section key={group.label} className="rounded-2xl border bg-white p-6 space-y-4">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">{group.label}</h2>
          <div className="space-y-3">
            {group.keys.map((key) => {
              const enabled = isEnabled(key)
              const meta    = AUTOMATION_LABELS[key]
              return (
                <div key={key} className="flex items-center gap-4 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{meta.name}</p>
                    <p className="text-xs text-slate mt-0.5">{meta.desc}</p>
                  </div>
                  <form action={toggleAutomation} className="flex-shrink-0">
                    <input type="hidden" name="key"        value={key} />
                    <input type="hidden" name="is_enabled" value={String(enabled)} />
                    <button
                      type="submit"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        enabled ? 'bg-brand-600' : 'bg-fog'
                      }`}
                      title={enabled ? 'Desactivar' : 'Activar'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
        <p className="text-xs text-amber-700 font-medium">¿Cuándo aplican los cambios?</p>
        <p className="text-xs text-amber-600 mt-1">
          Cada automatización corre en su ciclo de CRON (cada hora, diario, semanal). Al desactivar, el CRON
          se omite en el próximo disparo. Al reactivar, vuelve a correr normalmente.
          Los mensajes ya enviados no se revierten.
        </p>
      </div>
    </div>
  )
}
