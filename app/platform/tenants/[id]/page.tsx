import { notFound } from 'next/navigation'
import { fetchTenantDetail } from '@/lib/platform/tenants'
import {
  extendTrial,
  suspendTenant,
  reactivateTenant,
  assignPlan,
  enterTenant,
} from '@/app/actions/platform'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ ok?: string }>

const PLANS = ['trial', 'starter', 'pro', 'enterprise']

const OK_MESSAGES: Record<string, string> = {
  trial:       'Trial extendido correctamente.',
  suspended:   'Clínica suspendida.',
  reactivated: 'Clínica reactivada.',
  plan:        'Plan actualizado.',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusColor(status: string | null) {
  const map: Record<string, string> = {
    active: 'text-green-400', trialing: 'text-blue-400',
    past_due: 'text-amber-400', cancelled: 'text-red-400',
  }
  return map[status ?? ''] ?? 'text-gray-400'
}

export default async function TenantDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, { ok }] = await Promise.all([params, searchParams])
  const tenant = await fetchTenantDetail(id)
  if (!tenant) notFound()

  const enterAction = enterTenant.bind(null, tenant.id, tenant.name)
  const suspendAction = suspendTenant.bind(null, tenant.id, tenant.name)
  const reactivateAction = reactivateTenant.bind(null, tenant.id, tenant.name)

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Success banner */}
      {ok && OK_MESSAGES[ok] && (
        <div className="rounded-lg bg-green-900 border border-green-700 text-green-300 px-4 py-3 text-sm font-medium">
          ✓ {OK_MESSAGES[ok]}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">← <a href="/platform/tenants" className="hover:text-gray-300">Tenants</a></p>
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-mono">{tenant.slug}</span>
            {' · '}
            <span className={statusColor(tenant.subscription_status)}>{tenant.subscription_status ?? '—'}</span>
            {' · '}
            <span className="text-gray-400">Plan: {tenant.plan ?? '—'}</span>
          </p>
        </div>

        {/* Enter tenant */}
        <form action={enterAction}>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Entrar como soporte →
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Subscription info */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">Suscripción</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Estado"      value={tenant.subscription_status ?? '—'} />
            <Row label="Plan"        value={tenant.plan ?? '—'} />
            <Row label="Trial hasta" value={fmt(tenant.trial_ends_at)} />
            <Row label="Período fin" value={fmt(tenant.current_period_end)} />
            <Row label="Registrada"  value={fmt(tenant.created_at)} />
            <Row label="Miembros"    value={String(tenant.memberCount)} />
          </dl>
        </section>

        {/* Actions */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">Acciones de plataforma</h2>

          {/* Extend trial */}
          <div className="space-y-1">
            <p className="text-xs text-gray-400">Extender trial</p>
            <div className="flex gap-2">
              {[7, 14, 30].map((days) => {
                const action = extendTrial.bind(null, tenant.id, tenant.name, days)
                return (
                  <form key={days} action={action}>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-blue-200 text-xs font-semibold rounded-lg transition-colors"
                    >
                      +{days}d
                    </button>
                  </form>
                )
              })}
            </div>
          </div>

          {/* Assign plan */}
          <div className="space-y-1">
            <p className="text-xs text-gray-400">Asignar plan</p>
            <div className="flex flex-wrap gap-2">
              {PLANS.map((plan) => {
                const action = assignPlan.bind(null, tenant.id, tenant.name, plan)
                return (
                  <form key={plan} action={action}>
                    <button
                      type="submit"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        tenant.plan === plan
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {plan}
                    </button>
                  </form>
                )
              })}
            </div>
          </div>

          {/* Suspend / Reactivate */}
          <div className="flex gap-2 pt-2 border-t border-gray-800">
            {tenant.subscription_status !== 'cancelled' ? (
              <form action={suspendAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Suspender clínica
                </button>
              </form>
            ) : (
              <form action={reactivateAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-green-900 hover:bg-green-800 text-green-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Reactivar clínica
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* Members */}
      <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">Miembros ({tenant.memberCount})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {tenant.members.map((m) => (
              <tr key={m.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-200">{m.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    m.role === 'owner'  ? 'bg-purple-900 text-purple-300 border-purple-800' :
                    m.role === 'doctor' ? 'bg-blue-900 text-blue-300 border-blue-800' :
                    'bg-gray-800 text-gray-400 border-gray-700'
                  }`}>
                    {m.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Audit log */}
      {tenant.recentActivity.length > 0 && (
        <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200">Historial de acciones de plataforma</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {tenant.recentActivity.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase">{a.action_type}</span>
                  <span className="text-xs text-gray-500 ml-2">por {a.actor_email ?? '—'}</span>
                  {Object.keys(a.details).length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{JSON.stringify(a.details)}</p>
                  )}
                </div>
                <p className="text-xs text-gray-600 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-200 font-medium">{value}</dd>
    </div>
  )
}
