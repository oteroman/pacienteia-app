import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { extendTrial } from '@/app/actions/platform'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

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

  const [{ data: orgs }, { data: auditRows }] = await Promise.all([
    sb.from('organizations')
      .select('id, name, slug, plan, subscription_status, trial_ends_at')
      .order('created_at', { ascending: false }),
    sb.from('platform_audit_log')
      .select('action_type, actor_email, organization_name, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const all: ClinicSummary[] = orgs ?? []
  const now     = new Date()
  const in7days = new Date(now.getTime() + 7 * 86400000)

  const activeList  = all.filter(c => c.subscription_status === 'active')
  const trialing    = all.filter(c => c.subscription_status === 'trialing').length
  const cancelled   = all.filter(c => c.subscription_status === 'cancelled').length
  const urgentTrials = all.filter(c =>
    c.subscription_status === 'trialing' &&
    c.trial_ends_at != null &&
    new Date(c.trial_ends_at) <= in7days
  )

  const mrr = activeList.reduce((sum, c) => sum + (PLAN_CONFIG[c.plan as Plan]?.price_pen ?? 0), 0)

  return {
    total: all.length,
    active: activeList.length,
    trialing,
    cancelled,
    mrr,
    urgentTrials,
    recentActions: auditRows ?? [],
  }
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
  create_tenant: 'Clínica creada',
  extend_trial:  'Trial extendido',
  suspend:       'Suspendido',
  reactivate:    'Reactivado',
  assign_plan:   'Plan asignado',
  enter_tenant:  'Entró como soporte',
  exit_tenant:   'Salió de soporte',
}

export default async function PlatformHome() {
  const { total, active, trialing, cancelled, mrr, urgentTrials, recentActions } = await getPlatformOverview()

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Plataforma PacienteIA</h1>
        <p className="text-sm text-slate mt-0.5">Consola de administración SaaS · todos los tenants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="MRR actual"    value={`S/ ${mrr.toLocaleString('es-PE')}`} color="text-lima-600" accent />
        <StatCard label="Activos"       value={active}    color="text-ink" />
        <StatCard label="En trial"      value={trialing}  color="text-brand-600" />
        <StatCard label="Cancelados"    value={cancelled} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Urgent trials */}
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-700">
              Trials expirando pronto
              {urgentTrials.length > 0 && (
                <span className="ml-2 text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  {urgentTrials.length}
                </span>
              )}
            </h2>
            <Link href="/platform/trials" className="text-xs text-amber-600 hover:text-amber-700">
              Ver todos →
            </Link>
          </div>

          {urgentTrials.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate">Sin trials urgentes en los próximos 7 días.</p>
          ) : (
            <div className="divide-y divide-amber-200">
              {urgentTrials.map((t) => {
                const days = daysLeft(t.trial_ends_at)
                const extendAction7  = extendTrial.bind(null, t.id, t.name, 7)
                const extendAction14 = extendTrial.bind(null, t.id, t.name, 14)
                return (
                  <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{t.name}</p>
                      <p className={`text-xs font-bold ${days !== null && days <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                        {days === null ? '—' : days <= 0 ? 'Expirado' : `${days}d restantes`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <form action={extendAction7}>
                        <button type="submit" className="px-2 py-1 bg-mist hover:bg-[#EEF0F3] text-slate text-xs font-semibold rounded transition-colors">+7d</button>
                      </form>
                      <form action={extendAction14}>
                        <button type="submit" className="px-2 py-1 bg-mist hover:bg-[#EEF0F3] text-slate text-xs font-semibold rounded transition-colors">+14d</button>
                      </form>
                      <Link href={`/platform/tenants/${t.id}`} className="px-2 py-1 bg-mist hover:bg-[#EEF0F3] text-slate text-xs font-semibold rounded transition-colors">
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
        <section className="rounded-xl border border-fog bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate">Actividad reciente</h2>
            <Link href="/platform/audit" className="text-xs text-slate hover:text-ink">
              Ver todo →
            </Link>
          </div>
          {recentActions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate">Sin acciones registradas.</p>
          ) : (
            <div className="divide-y divide-fog">
              {recentActions.map((a: any, i: number) => (
                <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate">
                      {ACTION_LABEL[a.action_type] ?? a.action_type}
                      {a.organization_name && <span className="font-normal text-slate"> · {a.organization_name}</span>}
                    </p>
                    <p className="text-[10px] text-slate">{a.actor_email}</p>
                  </div>
                  <p className="text-[10px] text-slate whitespace-nowrap flex-shrink-0">{fmtDate(a.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Tenants',   href: '/platform/tenants', desc: 'Lista y detalle de todos los clientes',  icon: '🏥' },
          { label: 'Trials',    href: '/platform/trials',  desc: 'Gestionar períodos de prueba',           icon: '⏳' },
          { label: 'Revenue',   href: '/platform/mrr',     desc: 'MRR, activación, upsell, zombies',       icon: '💰' },
          { label: 'Salud',     href: '/platform/health',  desc: 'Fricción y bloqueos de gating',          icon: '🩺' },
          { label: 'Ventas',    href: '/platform/sales',   desc: 'Pipeline Paxi · prospectos WhatsApp',    icon: '🤖' },
          { label: 'Auditoría', href: '/platform/audit',   desc: 'Log de acciones de plataforma',          icon: '📋' },
        ].map(({ label, href, desc, icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-fog bg-white hover:bg-mist shadow-xs p-4 transition-all group"
          >
            <p className="text-lg mb-1">{icon}</p>
            <p className="text-sm font-semibold text-ink">{label}</p>
            <p className="text-[10px] text-slate mt-0.5 leading-tight">{desc}</p>
          </Link>
        ))}
      </div>

    </div>
  )
}

function StatCard({ label, value, color, accent }: { label: string; value: number | string; color: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 text-center shadow-xs ${accent ? 'border-lima-200 bg-lima-50' : 'border-fog bg-white'}`}>
      <p className={`text-3xl font-bold tabular-nums font-mono ${color}`}>{value}</p>
      <p className="text-xs text-slate mt-1 uppercase tracking-wide">{label}</p>
    </div>
  )
}
