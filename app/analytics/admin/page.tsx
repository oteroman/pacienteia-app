import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

// ── Types ────────────────────────────────────────────────
type EventRow = {
  organization_id: string
  event:           string
  resource:        string | null
  gate_state:      string | null
  source_page:     string | null
  created_at:      string
}

type OrgRow = {
  id:                  string
  name:                string
  plan:                string | null
  subscription_status: string | null
}

type UsageRow = {
  organization_id: string
  leads:           number
  appointments:    number
  active_users:    number
}

// ── Helpers ──────────────────────────────────────────────
function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

function periodStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Page ─────────────────────────────────────────────────
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const params = await searchParams
  const secret = process.env.ADMIN_DASHBOARD_SECRET ?? 'pacienteia_admin_2026'
  if (params.key !== secret) notFound()

  const supabase = createAdminClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Fetch last 7 days of events, all orgs
  const { data: rawEvents } = await supabase
    .from('gating_events')
    .select('organization_id, event, resource, gate_state, source_page, created_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(2000)

  const events = (rawEvents ?? []) as unknown as EventRow[]
  const orgIds = [...new Set(events.map((e) => e.organization_id))]

  // Org metadata + usage (parallel, skip if no events)
  const [rawOrgs, rawUsage] = orgIds.length > 0
    ? await Promise.all([
        supabase.from('organizations').select('id, name, plan, subscription_status').in('id', orgIds),
        supabase.from('subscription_usage').select('organization_id, leads, appointments, active_users').in('organization_id', orgIds).eq('period_start', periodStart()),
      ])
    : [{ data: [] }, { data: [] }]

  const clinicMap = new Map<string, OrgRow>(
    ((rawOrgs.data ?? []) as unknown as OrgRow[]).map((c) => [c.id, c])
  )
  const usageMap = new Map<string, UsageRow>(
    ((rawUsage.data ?? []) as unknown as UsageRow[]).map((u) => [u.organization_id, u])
  )

  // ── Aggregates ───────────────────────────────────────
  const blocked   = events.filter((e) => e.event === 'blocked_action_attempted')
  const opened    = events.filter((e) => e.event === 'modal_opened')
  const primary   = events.filter((e) => e.event === 'cta_primary_clicked')
  const secondary = events.filter((e) => e.event === 'cta_secondary_clicked')

  const softClinicIds = new Set(blocked.filter((e) => e.gate_state === 'soft_blocked').map((e) => e.organization_id))
  const hardClinicIds = new Set(blocked.filter((e) => e.gate_state === 'hard_blocked').map((e) => e.organization_id))

  // ── By resource ──────────────────────────────────────
  const resources = ['leads', 'appointments', 'users'] as const
  const byResource = resources.map((r) => {
    const rBlocked = blocked.filter((e) => e.resource === r)
    const rOpened  = opened.filter((e) => e.resource === r)
    const rPrimary = primary.filter((e) => e.resource === r)
    return {
      resource:  r,
      total:     rBlocked.length,
      soft:      rBlocked.filter((e) => e.gate_state === 'soft_blocked').length,
      hard:      rBlocked.filter((e) => e.gate_state === 'hard_blocked').length,
      modalRate: pct(rOpened.length, rBlocked.length),
      ctaRate:   pct(rPrimary.length, rOpened.length),
    }
  })

  // ── Top pages by friction ────────────────────────────
  const pageMap = blocked.reduce<Record<string, number>>((acc, e) => {
    if (e.source_page) acc[e.source_page] = (acc[e.source_page] ?? 0) + 1
    return acc
  }, {})
  const topPages = Object.entries(pageMap).sort(([, a], [, b]) => b - a).slice(0, 10)

  // ── Top clinics by friction ──────────────────────────
  const clinicBlockMap = blocked.reduce<Record<string, number>>((acc, e) => {
    acc[e.organization_id] = (acc[e.organization_id] ?? 0) + 1
    return acc
  }, {})
  const topClinics = Object.entries(clinicBlockMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, count]) => ({
      id,
      name:  clinicMap.get(id)?.name ?? id.slice(0, 8),
      plan:  clinicMap.get(id)?.plan ?? 'trial',
      count,
    }))

  // ── Upgrade candidates ───────────────────────────────
  const clinicCtaMap = primary.reduce<Record<string, number>>((acc, e) => {
    acc[e.organization_id] = (acc[e.organization_id] ?? 0) + 1
    return acc
  }, {})

  const upgradeCandidates = [...new Set([...softClinicIds, ...hardClinicIds])]
    .map((id) => {
      const clinic  = clinicMap.get(id)
      const usage   = usageMap.get(id)
      const plan    = (clinic?.plan ?? 'trial') as Plan
      const limits  = PLAN_CONFIG[plan] ?? PLAN_CONFIG.trial
      const isHard  = hardClinicIds.has(id)
      const hasCta  = (clinicCtaMap[id] ?? 0) > 0
      const blocks7d = clinicBlockMap[id] ?? 0
      const lastEvent = events.find((e) => e.organization_id === id)?.created_at ?? null

      const leadsUsed  = usage?.leads ?? 0
      const aptUsed    = usage?.appointments ?? 0
      const leadsLimit = limits.leads_per_month
      const aptLimit   = limits.appointments_per_month
      const leadsPct   = leadsLimit > 0 ? pct(leadsUsed, leadsLimit) : 0
      const aptPct     = aptLimit > 0 ? pct(aptUsed, aptLimit) : 0
      const maxPct     = Math.max(leadsPct, aptPct)

      return {
        id,
        name:           clinic?.name ?? id.slice(0, 8),
        plan,
        status:         clinic?.subscription_status ?? 'unknown',
        blocks7d,
        gate:           isHard ? 'hard' : 'soft',
        maxPct,
        hasCta,
        lastEvent,
        recommendation: isHard ? 'upgrade_now' : hasCta ? 'follow_up' : 'mostrar_precios',
      }
    })
    .sort((a, b) => b.blocks7d - a.blocks7d)

  const lowCtr = pct(primary.length, opened.length) < 15 && opened.length > 5

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin · Salud comercial</h1>
          <p className="text-sm text-gray-500 mt-1">Últimos 7 días · todas las clínicas</p>
        </div>
        <span className="text-xs text-gray-300 font-mono">internal · no compartir</span>
      </div>

      {/* A. Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <AdminMetric label="Intentos bloqueados" value={blocked.length} />
        <AdminMetric label="Modales abiertos"    value={opened.length}
          sub={`${pct(opened.length, blocked.length)}% de intentos`} />
        <AdminMetric label="CTA primario"        value={primary.length}
          sub={`${pct(primary.length, opened.length)}% de abiertos`} highlight />
        <AdminMetric label="CTA secundario"      value={secondary.length} />
        <AdminMetric label="Cuentas al 80%+"     value={softClinicIds.size} warn />
        <AdminMetric label="Cuentas al 100%"     value={hardClinicIds.size} danger />
      </div>

      {/* E. Alerts */}
      {(hardClinicIds.size > 0 || softClinicIds.size > 0 || lowCtr) && (
        <Section title="Alertas">
          <div className="space-y-2">
            {hardClinicIds.size > 0 && (
              <Alert level="danger"
                message={`${hardClinicIds.size} cuenta${hardClinicIds.size > 1 ? 's' : ''} al 100% — sin acceso a crear recursos`} />
            )}
            {softClinicIds.size > 0 && (
              <Alert level="warn"
                message={`${softClinicIds.size} cuenta${softClinicIds.size > 1 ? 's' : ''} al 80%+ — acercándose al límite`} />
            )}
            {lowCtr && (
              <Alert level="info"
                message={`CTA primario al ${pct(primary.length, opened.length)}% — conversión baja, revisar copy del modal`} />
            )}
          </div>
        </Section>
      )}

      {/* B. By resource */}
      <Section title="Bloqueos por recurso (7d)">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-medium">Recurso</th>
              <th className="pb-2 font-medium text-right">Total</th>
              <th className="pb-2 font-medium text-right">Soft</th>
              <th className="pb-2 font-medium text-right">Hard</th>
              <th className="pb-2 font-medium text-right">Modal %</th>
              <th className="pb-2 font-medium text-right">CTA %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {byResource.map((r) => (
              <tr key={r.resource} className={r.total === 0 ? 'text-gray-300' : 'text-gray-900'}>
                <td className="py-2.5 capitalize">{r.resource}</td>
                <td className="py-2.5 text-right font-medium">{r.total}</td>
                <td className="py-2.5 text-right text-amber-600">{r.soft}</td>
                <td className="py-2.5 text-right text-red-600">{r.hard}</td>
                <td className="py-2.5 text-right text-gray-500">{r.modalRate}%</td>
                <td className={`py-2.5 text-right font-medium ${r.ctaRate >= 20 ? 'text-green-600' : 'text-gray-500'}`}>
                  {r.ctaRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* C. Top friction */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Section title="Top páginas con fricción">
          {topPages.length === 0 ? <Empty /> : (
            <ul className="space-y-2">
              {topPages.map(([page, count]) => (
                <li key={page} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-mono text-xs truncate">{page}</span>
                  <span className="font-semibold text-gray-900 ml-2 shrink-0">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Top cuentas con fricción">
          {topClinics.length === 0 ? <Empty /> : (
            <ul className="space-y-2">
              {topClinics.map(({ id, name, plan, count }) => (
                <li key={id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="text-gray-800 font-medium truncate block">{name}</span>
                    <span className="text-xs text-gray-400 capitalize">{plan}</span>
                  </div>
                  <span className="font-semibold text-gray-900 ml-2 shrink-0">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* D. Upgrade candidates */}
      <Section title="Candidatos a upgrade">
        {upgradeCandidates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Sin cuentas bloqueadas en los últimos 7 días
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium pl-2">Clínica</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium text-right">7d bloqueos</th>
                  <th className="pb-2 font-medium text-center">Estado</th>
                  <th className="pb-2 font-medium text-center">Uso máx.</th>
                  <th className="pb-2 font-medium text-center">CTA</th>
                  <th className="pb-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {upgradeCandidates.map((c) => (
                  <tr key={c.id} className="text-gray-800">
                    <td className="py-2.5 pl-2">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{c.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-2.5 capitalize text-gray-600">{c.plan}</td>
                    <td className="py-2.5 text-right font-bold">{c.blocks7d}</td>
                    <td className="py-2.5 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        c.gate === 'hard'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {c.gate === 'hard' ? 'hard' : 'soft'}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      {c.maxPct > 0 ? (
                        <span className={`text-xs font-medium ${
                          c.maxPct >= 100 ? 'text-red-600' : c.maxPct >= 80 ? 'text-amber-600' : 'text-gray-500'
                        }`}>
                          {c.maxPct}%
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 text-center text-sm">
                      {c.hasCta
                        ? <span className="text-green-600 font-medium">✓</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5">
                      <RecomBadge r={c.recommendation} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {events.length === 0 && (
        <div className="text-center py-12 text-gray-400 space-y-2">
          <p className="text-4xl">📊</p>
          <p className="text-sm">Sin eventos en los últimos 7 días.</p>
        </div>
      )}
    </div>
  )
}

// ── UI helpers ────────────────────────────────────────────

function AdminMetric({ label, value, sub, highlight, warn, danger }: {
  label: string; value: number; sub?: string
  highlight?: boolean; warn?: boolean; danger?: boolean
}) {
  const bg = danger    ? 'bg-red-50 border border-red-100'
           : warn      ? 'bg-amber-50 border border-amber-100'
           : highlight ? 'bg-brand-50 border border-brand-100'
                       : 'bg-gray-50'
  const valCls = danger    ? 'text-red-700'
               : warn      ? 'text-amber-700'
               : highlight ? 'text-brand-700'
                           : 'text-gray-900'
  return (
    <div className={`rounded-xl p-4 text-center space-y-1 ${bg}`}>
      <p className={`text-2xl font-bold ${valCls}`}>{value}</p>
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
}

function Alert({ level, message }: { level: 'danger' | 'warn' | 'info'; message: string }) {
  const cls = {
    danger: 'bg-red-50 border-red-200 text-red-700',
    warn:   'bg-amber-50 border-amber-200 text-amber-700',
    info:   'bg-blue-50 border-blue-200 text-blue-700',
  }[level]
  const icon = { danger: '🔴', warn: '🟡', info: 'ℹ️' }[level]
  return (
    <div className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 ${cls}`}>
      <span>{icon}</span>
      <span>{message}</span>
    </div>
  )
}

function RecomBadge({ r }: { r: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    upgrade_now:      { label: 'Upgrade ya',      cls: 'bg-red-50 text-red-700' },
    follow_up:        { label: 'Follow-up',       cls: 'bg-green-50 text-green-700' },
    mostrar_precios:  { label: 'Mostrar precios', cls: 'bg-blue-50 text-blue-700' },
  }
  const { label, cls } = map[r] ?? { label: r, cls: 'bg-gray-50 text-gray-700' }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
  )
}
