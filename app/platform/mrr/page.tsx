import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

interface OrgRow {
  id:                  string
  name:                string
  plan:                string | null
  subscription_status: string | null
  trial_ends_at:       string | null
  created_at:          string
}

interface WaConfig {
  organization_id: string
  status:          string
}

function planPrice(plan: string | null): number {
  if (!plan) return 0
  return PLAN_CONFIG[plan as Plan]?.price_pen ?? 0
}

function periodStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function fmtSoles(n: number) {
  return `S/ ${n.toLocaleString('es-PE')}`
}

const SOURCE_LABELS: Record<string, string> = {
  paxi:        'Paxi (bot)',
  referido:    'Referido',
  outreach:    'Outreach frío',
  google:      'Google / SEO',
  evento:      'Evento / Demo',
  otro:        'Otro',
  sin_definir: 'Sin definir',
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

async function getMrrData() {
  noStore()
  const sb = createAdminClient() as any

  const [{ data: orgs }, { data: waConfigs }, { data: usageRows }, { data: auditConversions }] = await Promise.all([
    sb.from('organizations')
      .select('id, name, plan, subscription_status, trial_ends_at, created_at, acquisition_source')
      .order('created_at', { ascending: false }),
    sb.from('branch_whatsapp_config')
      .select('organization_id, status')
      .eq('status', 'active'),
    sb.from('subscription_usage')
      .select('organization_id, leads, appointments')
      .eq('period_start', periodStart()),
    // assign_plan events to paid plans — used for conversion time
    sb.from('platform_audit_log')
      .select('organization_id, created_at, details')
      .eq('action_type', 'assign_plan')
      .order('created_at', { ascending: true }),
  ])

  const all: OrgRow[]    = orgs ?? []
  const waList: WaConfig[] = waConfigs ?? []

  // Activated orgs (have at least one active WhatsApp config)
  const activatedOrgIds = new Set(waList.map((w) => w.organization_id))

  // Usage map
  const usageMap: Record<string, { leads: number; appointments: number }> = {}
  for (const u of (usageRows ?? [])) {
    usageMap[u.organization_id] = { leads: u.leads ?? 0, appointments: u.appointments ?? 0 }
  }

  const active   = all.filter((o) => o.subscription_status === 'active')
  const trialing = all.filter((o) => o.subscription_status === 'trialing')
  const churned  = all.filter((o) => o.subscription_status === 'cancelled')

  // MRR from active paying accounts
  const mrr = active.reduce((sum, o) => sum + planPrice(o.plan), 0)
  const arr  = mrr * 12

  // Potential MRR if all trials convert
  const trialPotentialMrr = trialing.reduce((sum, o) => sum + planPrice(o.plan), 0)

  // New this month (active accounts created this calendar month)
  const monthStart = new Date(periodStart())
  const newThisMonth = active.filter((o) => new Date(o.created_at) >= monthStart)
  const newMrr = newThisMonth.reduce((sum, o) => sum + planPrice(o.plan), 0)

  // Churned this month (rough: cancelled AND created before this month — no churn date)
  // Better: use audit log for suspend events this month — skip for now, mark as N/A

  // Plan breakdown
  const planMap: Record<string, { count: number; mrr: number }> = {}
  for (const o of active) {
    const p = o.plan ?? 'unknown'
    planMap[p] = { count: (planMap[p]?.count ?? 0) + 1, mrr: (planMap[p]?.mrr ?? 0) + planPrice(o.plan) }
  }

  // Activation rate (trialing with WhatsApp connected)
  const activatedTrials = trialing.filter((o) => activatedOrgIds.has(o.id))
  const activationRate  = trialing.length > 0
    ? Math.round((activatedTrials.length / trialing.length) * 100)
    : 0

  // Zombie accounts: trialing, no WhatsApp connected, registered > 5 days ago
  const zombies = trialing.filter(
    (o) => !activatedOrgIds.has(o.id) && daysAgo(o.created_at) > 5
  )

  // Conversion rate: cohort last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
  const cohort90      = all.filter((o) => new Date(o.created_at) >= ninetyDaysAgo)
  const cohortPaid    = cohort90.filter((o) => o.subscription_status === 'active' && planPrice(o.plan) > 0)
  const cohortLost    = cohort90.filter((o) => o.subscription_status === 'cancelled')
  const conversionRate = cohort90.length > 0
    ? Math.round((cohortPaid.length / cohort90.length) * 100) : 0

  // Average days to convert (from org.created_at to first paid assign_plan event)
  const firstConversionByOrg: Record<string, string> = {}
  for (const row of (auditConversions ?? [])) {
    const plan = (row.details as any)?.plan
    if (plan && planPrice(plan) > 0 && !firstConversionByOrg[row.organization_id]) {
      firstConversionByOrg[row.organization_id] = row.created_at
    }
  }
  const conversionDays = cohortPaid
    .map((o) => {
      const convAt = firstConversionByOrg[o.id]
      if (!convAt) return null
      return Math.round((new Date(convAt).getTime() - new Date(o.created_at).getTime()) / 86400000)
    })
    .filter((d): d is number => d !== null && d >= 0)
  const avgDaysToConvert = conversionDays.length > 0
    ? Math.round(conversionDays.reduce((a, b) => a + b, 0) / conversionDays.length) : null

  // Acquisition source breakdown (active paying accounts)
  const sourceMap: Record<string, { count: number; mrr: number }> = {}
  for (const o of active) {
    const src = (o as any).acquisition_source ?? 'sin_definir'
    sourceMap[src] = {
      count: (sourceMap[src]?.count ?? 0) + 1,
      mrr:   (sourceMap[src]?.mrr   ?? 0) + planPrice(o.plan),
    }
  }

  // Upsell candidates: active accounts using >70% of their plan limit
  const upsellCandidates = active
    .map((o) => {
      const plan   = (o.plan ?? 'trial') as Plan
      const limits = PLAN_CONFIG[plan] ?? PLAN_CONFIG.trial
      const usage  = usageMap[o.id]
      if (!usage) return null
      const leadsPct = limits.leads_per_month > 0
        ? Math.round((usage.leads / limits.leads_per_month) * 100) : 0
      const aptPct = limits.appointments_per_month > 0
        ? Math.round((usage.appointments / limits.appointments_per_month) * 100) : 0
      const maxPct = Math.max(leadsPct, aptPct)
      if (maxPct < 70) return null
      return { id: o.id, name: o.name, plan, maxPct }
    })
    .filter(Boolean) as { id: string; name: string; plan: string; maxPct: number }[]

  return {
    mrr, arr, newMrr, trialPotentialMrr,
    active, trialing, churned,
    planMap, activationRate, activatedTrials,
    zombies, upsellCandidates,
    conversionRate, cohort90, cohortPaid, cohortLost, avgDaysToConvert,
    sourceMap,
  }
}

export default async function MrrPage() {
  const d = await getMrrData()

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Revenue & Growth</h1>
        <p className="text-sm text-slate mt-0.5">MRR, activación y oportunidades · tiempo real</p>
      </div>

      {/* MRR strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BigStat label="MRR actual"         value={fmtSoles(d.mrr)}               color="text-ink"      sub={`ARR: ${fmtSoles(d.arr)}`} />
        <BigStat label="MRR nuevo este mes" value={fmtSoles(d.newMrr)}            color="text-lima-600"  sub={`${d.active.filter(o => new Date(o.created_at) >= new Date(new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-01')).length} cuenta(s)`} />
        <BigStat label="Pipeline en trial"  value={fmtSoles(d.trialPotentialMrr)} color="text-brand-600"   sub={`${d.trialing.length} trials`} />
        <BigStat label="Activación trial"   value={`${d.activationRate}%`}        color={d.activationRate >= 60 ? 'text-lima-600' : d.activationRate >= 30 ? 'text-amber-600' : 'text-red-600'} sub={`${d.activatedTrials.length}/${d.trialing.length} con WhatsApp`} />
      </div>

      {/* Conversion + Source row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Trial → Pago conversion */}
        <section className="rounded-xl border border-fog bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate">Conversión trial → pago</h2>
            <p className="text-xs text-slate mt-0.5">Cohorte últimos 90 días · {d.cohort90.length} trials</p>
          </div>
          <div className="flex items-end gap-6">
            <div className="text-center">
              <p className={`text-3xl font-bold tabular-nums ${d.conversionRate >= 30 ? 'text-lima-600' : d.conversionRate >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                {d.conversionRate}%
              </p>
              <p className="text-xs text-slate mt-1">Tasa de conversión</p>
            </div>
            {d.avgDaysToConvert !== null && (
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums text-blue-400">{d.avgDaysToConvert}d</p>
                <p className="text-xs text-slate mt-1">Días promedio a pagar</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums text-red-600">{d.cohortLost.length}</p>
              <p className="text-xs text-slate mt-1">Cancelados</p>
            </div>
          </div>
          <div className="w-full bg-mist rounded-full h-2 overflow-hidden">
            <div
              className="bg-lima-500 h-2 rounded-full"
              style={{ width: `${d.cohort90.length > 0 ? (d.cohortPaid.length / d.cohort90.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-slate">
            {d.cohortPaid.length} convertidos · {d.cohortLost.length} cancelados · {d.cohort90.length - d.cohortPaid.length - d.cohortLost.length} aún en trial
          </p>
        </section>

        {/* Acquisition source */}
        <section className="rounded-xl border border-fog bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate">Fuente de adquisición</h2>
            <p className="text-xs text-slate mt-0.5">Cuentas activas pagando · MRR por canal</p>
          </div>
          {Object.keys(d.sourceMap).length === 0 ? (
            <p className="text-sm text-slate text-center py-4">Sin datos — define la fuente en cada tenant</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate border-b border-fog">
                  <th className="pb-2 font-medium text-xs">Fuente</th>
                  <th className="pb-2 font-medium text-xs text-right">Cuentas</th>
                  <th className="pb-2 font-medium text-xs text-right">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fog">
                {Object.entries(d.sourceMap)
                  .sort(([,a],[,b]) => b.mrr - a.mrr)
                  .map(([src, { count, mrr: srcMrr }]) => (
                    <tr key={src}>
                      <td className="py-2 text-slate capitalize">{SOURCE_LABELS[src] ?? src}</td>
                      <td className="py-2 text-right text-ink font-bold tabular-nums">{count}</td>
                      <td className="py-2 text-right text-lima-600 font-bold tabular-nums">{fmtSoles(srcMrr)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Plan breakdown */}
      <section className="rounded-xl border border-fog bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-fog">
          <h2 className="text-sm font-semibold text-slate">Desglose por plan</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fog text-left">
              <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Plan</th>
              <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-right">Precio/mes</th>
              <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-right">Cuentas</th>
              <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-right">MRR</th>
              <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-right">% del total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fog">
            {Object.entries(d.planMap).sort(([,a],[,b]) => b.mrr - a.mrr).map(([plan, { count, mrr }]) => (
              <tr key={plan} className="hover:bg-mist/50">
                <td className="px-5 py-3 font-medium text-slate capitalize">{plan}</td>
                <td className="px-5 py-3 text-right text-slate">{fmtSoles(PLAN_CONFIG[plan as Plan]?.price_pen ?? 0)}</td>
                <td className="px-5 py-3 text-right text-ink font-bold tabular-nums">{count}</td>
                <td className="px-5 py-3 text-right text-lima-600 font-bold tabular-nums">{fmtSoles(mrr)}</td>
                <td className="px-5 py-3 text-right text-slate">
                  {d.mrr > 0 ? `${Math.round((mrr / d.mrr) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
            {Object.keys(d.planMap).length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate text-sm">Sin cuentas activas aún</td>
              </tr>
            )}
            {d.mrr > 0 && (
              <tr className="bg-mist font-bold">
                <td className="px-5 py-3 text-slate">Total</td>
                <td className="px-5 py-3" />
                <td className="px-5 py-3 text-right text-ink tabular-nums">{d.active.length}</td>
                <td className="px-5 py-3 text-right text-green-300 tabular-nums">{fmtSoles(d.mrr)}</td>
                <td className="px-5 py-3 text-right text-slate">100%</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Zombie accounts */}
      <section className="rounded-xl border border-red-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-red-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-red-300 flex items-center gap-2">
              Cuentas zombie
              {d.zombies.length > 0 && (
                <span className="bg-red-500 text-ink text-xs font-bold px-2 py-0.5 rounded-full">{d.zombies.length}</span>
              )}
            </h2>
            <p className="text-xs text-slate mt-0.5">Trials &gt;5 días sin conectar WhatsApp · riesgo de no conversión</p>
          </div>
          <Link href="/platform/trials" className="text-xs text-slate hover:text-slate">Ver todos los trials →</Link>
        </div>
        {d.zombies.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate">Sin zombies. Buen trabajo.</p>
        ) : (
          <div className="divide-y divide-fog">
            {d.zombies.map((o) => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate truncate">{o.name}</p>
                  <p className="text-xs text-red-600">
                    Registrado hace {daysAgo(o.created_at)}d · sin WhatsApp
                    {o.trial_ends_at && ` · vence en ${daysLeft(o.trial_ends_at)}d`}
                  </p>
                </div>
                <Link
                  href={`/platform/tenants/${o.id}`}
                  className="shrink-0 text-xs text-slate hover:text-ink border border-fog hover:border-fog0 px-2 py-1 rounded transition-colors"
                >
                  Activar →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upsell candidates */}
      <section className="rounded-xl border border-fog bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-fog">
          <h2 className="text-sm font-semibold text-slate flex items-center gap-2">
            Cola de upsell
            {d.upsellCandidates.length > 0 && (
              <span className="bg-green-600 text-ink text-xs font-bold px-2 py-0.5 rounded-full">{d.upsellCandidates.length}</span>
            )}
          </h2>
          <p className="text-xs text-slate mt-0.5">Cuentas activas usando &gt;70% de su límite mensual</p>
        </div>
        {d.upsellCandidates.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate">Sin candidatos de upsell este mes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fog text-left">
                <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Clínica</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Plan actual</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-right">Uso máx.</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {d.upsellCandidates.sort((a, b) => b.maxPct - a.maxPct).map((c) => (
                <tr key={c.id} className="hover:bg-mist/50">
                  <td className="px-5 py-3 font-medium text-slate">{c.name}</td>
                  <td className="px-5 py-3 text-slate capitalize">{c.plan}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-sm font-bold ${c.maxPct >= 100 ? 'text-red-600' : 'text-amber-600'}`}>
                      {c.maxPct}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/platform/tenants/${c.id}`}
                      className="text-xs text-lima-600 hover:text-lima-700 border border-lima-200 hover:border-lima-300 px-2.5 py-1 rounded transition-colors"
                    >
                      Upgrade →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function BigStat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-fog bg-white p-5 text-center space-y-1">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-slate">{sub}</p>}
    </div>
  )
}
