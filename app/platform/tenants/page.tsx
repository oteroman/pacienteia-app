import Link   from 'next/link'
import { fetchAllTenants } from '@/lib/platform/tenants'

const SOURCE_LABEL: Record<string, string> = {
  paxi:     'Paxi',
  referido: 'Referido',
  outreach: 'Outreach',
  google:   'Google',
  evento:   'Evento',
  otro:     'Otro',
}

function statusBadge(status: string | null) {
  const s = status ?? 'unknown'
  const styles: Record<string, string> = {
    active:    'bg-green-50 text-green-700 border-green-200',
    trialing:  'bg-brand-50 text-brand-700 border-brand-200',
    past_due:  'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    unknown:   'bg-mist text-slate border-fog',
  }
  return `text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${styles[s] ?? styles.unknown}`
}

function planLabel(plan: string | null) {
  if (!plan) return '—'
  const labels: Record<string, string> = { trial: 'Trial', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }
  return labels[plan] ?? plan
}

function relativeDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'ayer'
  if (diff < 7) return `hace ${diff} días`
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

export default async function TenantsPage() {
  const tenants = await fetchAllTenants()

  const active    = tenants.filter(t => t.subscription_status === 'active').length
  const trialing  = tenants.filter(t => t.subscription_status === 'trialing').length
  const cancelled = tenants.filter(t => t.subscription_status === 'cancelled').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tenants</h1>
          <p className="text-sm text-slate mt-0.5">Clínicas registradas en la plataforma</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Stat label="Activas"    value={active}    color="text-lima-600" />
          <Stat label="Trial"      value={trialing}  color="text-brand-600"  />
          <Stat label="Canceladas" value={cancelled} color="text-red-600"   />
          <Link
            href="/platform/tenants/new"
            className="ml-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-ink text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            + Nueva clínica
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-fog bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-fog text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Clínica</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden sm:table-cell">Plan</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">Fuente</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden lg:table-cell">Último contacto</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden lg:table-cell">Registrada</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-mist transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{t.name}</p>
                    <p className="text-xs text-slate">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(t.subscription_status)}>{t.subscription_status ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate hidden sm:table-cell">{planLabel(t.plan)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {t.acquisition_source ? (
                      <span className="text-[10px] font-medium bg-mist text-slate border border-fog px-2 py-0.5 rounded-full">
                        {SOURCE_LABEL[t.acquisition_source] ?? t.acquisition_source}
                      </span>
                    ) : (
                      <span className="text-slate text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {t.lastCrmContact ? (
                      <span className="text-xs text-slate">{relativeDate(t.lastCrmContact)}</span>
                    ) : (
                      <span className="text-xs text-amber-500">Sin contacto</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate hidden lg:table-cell">{relativeDate(t.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/tenants/${t.id}`}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-600 transition-colors whitespace-nowrap"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tenants.length === 0 && (
          <div className="px-4 py-12 text-center text-slate text-sm">Sin tenants registrados.</div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center px-4 py-2 bg-white rounded-lg border border-fog">
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-slate uppercase tracking-wide">{label}</p>
    </div>
  )
}
