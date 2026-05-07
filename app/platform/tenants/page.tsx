import Link from 'next/link'
import { fetchAllTenants } from '@/lib/platform/tenants'

function statusBadge(status: string | null) {
  const s = status ?? 'unknown'
  const styles: Record<string, string> = {
    active:    'bg-green-900 text-green-300 border-green-800',
    trialing:  'bg-blue-900 text-blue-300 border-blue-800',
    past_due:  'bg-amber-900 text-amber-300 border-amber-800',
    cancelled: 'bg-red-900 text-red-300 border-red-800',
    unknown:   'bg-gray-800 text-gray-400 border-gray-700',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-sm text-gray-400 mt-0.5">Clínicas registradas en la plataforma</p>
        </div>
        <div className="flex gap-3">
          <Stat label="Activas"    value={active}    color="text-green-400" />
          <Stat label="Trial"      value={trialing}  color="text-blue-400"  />
          <Stat label="Canceladas" value={cancelled} color="text-red-400"   />
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Clínica</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Miembros</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Última actividad</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Registrada</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={statusBadge(t.subscription_status)}>{t.subscription_status ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-gray-300">{planLabel(t.plan)}</td>
                <td className="px-4 py-3 text-gray-300 tabular-nums">{t.memberCount}</td>
                <td className="px-4 py-3 text-gray-400">{relativeDate(t.lastActivity)}</td>
                <td className="px-4 py-3 text-gray-400">{relativeDate(t.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/platform/tenants/${t.id}`}
                    className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">Sin tenants registrados.</div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center px-4 py-2 bg-gray-900 rounded-lg border border-gray-800">
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
  )
}
