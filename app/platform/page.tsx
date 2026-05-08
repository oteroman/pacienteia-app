import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { extendTrial } from '@/app/actions/platform'

interface ClinicSummary {
  id: string
  name: string
  slug: string
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
}

async function getPlatformOverview() {
  noStore()
  const sb = createAdminClient() as any

  const { data: clinics } = await sb
    .from('clinics')
    .select('id, name, slug, plan, subscription_status, trial_ends_at')
    .order('created_at', { ascending: false })

  const { data: auditRows } = await sb
    .from('platform_audit_log')
    .select('action_type, actor_email, clinic_name, created_at')
    .order('created_at', { ascending: false })
    .limit(8)

  const all: ClinicSummary[] = clinics ?? []
  const now = new Date()
  const in7days = new Date(now.getTime() + 7 * 86400000)

  const active    = all.filter(c => c.subscription_status === 'active').length
  const trialing  = all.filter(c => c.subscription_status === 'trialing').length
  const cancelled = all.filter(c => c.subscription_status === 'cancelled').length
  const urgentTrials = all.filter(c =>
    c.subscription_status === 'trialing' &&
    c.trial_ends_at != null &&
    new Date(c.trial_ends_at) <= in7days
  )

  return { total: all.length, active, trialing, cancelled, urgentTrials, recentActions: auditRows ?? [] }
}

function daysLeft(iso: string | null) {
  if (!iso) return null
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return diff
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const ACTION_LABEL: Record<string, string> = {
  extend_trial:  'Trial extendido',
  suspend:       'Suspendido',
  reactivate:    'Reactivado',
  assign_plan:   'Plan asignado',
  enter_tenant:  'Entró como soporte',
  exit_tenant:   'Salió de soporte',
}

export default async function PlatformHome() {
  const { total, active, trialing, cancelled, urgentTrials, recentActions } = await getPlatformOverview()

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Plataforma PacienteIA</h1>
        <p className="text-sm text-gray-400 mt-0.5">Consola de administración SaaS · todos los tenants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total tenants" value={total}    color="text-white" />
        <StatCard label="Activos"       value={active}   color="text-green-400" />
        <StatCard label="En trial"      value={trialing} color="text-blue-400" />
        <StatCard label="Cancelados"    value={cancelled} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Urgent trials */}
        <section className="rounded-xl border border-amber-800/50 bg-amber-950/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-800/30 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-300">
              Trials expirando pronto
              {urgentTrials.length > 0 && (
                <span className="ml-2 text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  {urgentTrials.length}
                </span>
              )}
            </h2>
            <Link href="/platform/trials" className="text-xs text-amber-400 hover:text-amber-300">
              Ver todos →
            </Link>
          </div>

          {urgentTrials.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">Sin trials urgentes en los próximos 7 días.</p>
          ) : (
            <div className="divide-y divide-amber-800/20">
              {urgentTrials.map((t) => {
                const days = daysLeft(t.trial_ends_at)
                const extendAction7  = extendTrial.bind(null, t.id, t.name, 7)
                const extendAction14 = extendTrial.bind(null, t.id, t.name, 14)
                return (
                  <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                      <p className={`text-xs font-bold ${days !== null && days <= 2 ? 'text-red-400' : 'text-amber-400'}`}>
                        {days === null ? '—' : days <= 0 ? 'Expirado' : `${days}d restantes`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <form action={extendAction7}>
                        <button type="submit" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded transition-colors">+7d</button>
                      </form>
                      <form action={extendAction14}>
                        <button type="submit" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded transition-colors">+14d</button>
                      </form>
                      <Link href={`/platform/tenants/${t.id}`} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded transition-colors">
                        Ver
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Recent platform actions */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Actividad reciente</h2>
            <Link href="/platform/audit" className="text-xs text-gray-400 hover:text-gray-300">
              Ver todo →
            </Link>
          </div>
          {recentActions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">Sin acciones registradas.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {recentActions.map((a: any, i: number) => (
                <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-200">
                      {ACTION_LABEL[a.action_type] ?? a.action_type}
                      {a.clinic_name && <span className="font-normal text-gray-400"> · {a.clinic_name}</span>}
                    </p>
                    <p className="text-[10px] text-gray-600">{a.actor_email}</p>
                  </div>
                  <p className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">{fmtDate(a.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Tenants',      href: '/platform/tenants',  desc: 'Lista y detalle de todos los clientes' },
          { label: 'Trials',       href: '/platform/trials',   desc: 'Gestionar períodos de prueba' },
          { label: 'Salud',        href: '/platform/health',   desc: 'Fricción, bloqueos, upgrades' },
          { label: 'Indicadores',  href: `/analytics/admin?key=${process.env.ADMIN_DASHBOARD_SECRET ?? 'pacienteia_admin_2026'}`, desc: 'KPIs de decisión', external: true },
          { label: 'Auditoría',    href: '/platform/audit',    desc: 'Log de acciones de plataforma' },
        ].map(({ label, href, desc, external }) => (
          <Link
            key={href}
            href={href}
            target={external ? '_blank' : undefined}
            className="rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 p-4 transition-colors group"
          >
            <p className="text-sm font-semibold text-white group-hover:text-white">{label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{desc}</p>
          </Link>
        ))}
      </div>

    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
      <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
