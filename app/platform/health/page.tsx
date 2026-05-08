import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

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

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

function periodStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function PlatformHealthPage() {
  const supabase = createAdminClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: rawEvents } = await supabase
    .from('gating_events')
    .select('organization_id, event, resource, gate_state, source_page, created_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(2000)

  const events = (rawEvents ?? []) as unknown as EventRow[]
  const orgIds = [...new Set(events.map((e) => e.organization_id))]

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

  const blocked   = events.filter((e) => e.event === 'blocked_action_attempted')
  const opened    = events.filter((e) => e.event === 'modal_opened')
  const primary   = events.filter((e) => e.event === 'cta_primary_clicked')
  const secondary = events.filter((e) => e.event === 'cta_secondary_clicked')

  const softClinicIds = new Set(blocked.filter((e) => e.gate_state === 'soft_blocked').map((e) => e.organization_id))
  const hardClinicIds = new Set(blocked.filter((e) => e.gate_state === 'hard_blocked').map((e) => e.organization_id))

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

  const pageMap = blocked.reduce<Record<string, number>>((acc, e) => {
    if (e.source_page) acc[e.source_page] = (acc[e.source_page] ?? 0) + 1
    return acc
  }, {})
  const topPages = Object.entries(pageMap).sort(([, a], [, b]) => b - a).slice(0, 10)

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
      const leadsUsed  = usage?.leads ?? 0
      const aptUsed    = usage?.appointments ?? 0
      const leadsPct   = limits.leads_per_month > 0 ? pct(leadsUsed, limits.leads_per_month) : 0
      const aptPct     = limits.appointments_per_month > 0 ? pct(aptUsed, limits.appointments_per_month) : 0
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
        recommendation: isHard ? 'upgrade_now' : hasCta ? 'follow_up' : 'mostrar_precios',
      }
    })
    .sort((a, b) => b.blocks7d - a.blocks7d)

  const lowCtr = pct(primary.length, opened.length) < 15 && opened.length > 5

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Salud comercial</h1>
          <p className="text-sm text-gray-400 mt-0.5">Últimos 7 días · todas las clínicas</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="Intentos bloqueados" value={blocked.length} />
        <Metric label="Modales abiertos"    value={opened.length}
          sub={`${pct(opened.length, blocked.length)}% de intentos`} />
        <Metric label="CTA primario"        value={primary.length}
          sub={`${pct(primary.length, opened.length)}% de abiertos`} highlight />
        <Metric label="CTA secundario"      value={secondary.length} />
        <Metric label="Cuentas al 80%+"     value={softClinicIds.size} warn />
        <Metric label="Cuentas al 100%"     value={hardClinicIds.size} danger />
      </div>

      {/* Alerts */}
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

      {/* By resource */}
      <Section title="Bloqueos por recurso (7d)">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-700">
              <th className="pb-2 font-medium">Recurso</th>
              <th className="pb-2 font-medium text-right">Total</th>
              <th className="pb-2 font-medium text-right">Soft</th>
              <th className="pb-2 font-medium text-right">Hard</th>
              <th className="pb-2 font-medium text-right">Modal %</th>
              <th className="pb-2 font-medium text-right">CTA %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {byResource.map((r) => (
              <tr key={r.resource} className={r.total === 0 ? 'text-gray-600' : 'text-gray-200'}>
                <td className="py-2.5 capitalize">{r.resource}</td>
                <td className="py-2.5 text-right font-medium">{r.total}</td>
                <td className="py-2.5 text-right text-amber-400">{r.soft}</td>
                <td className="py-2.5 text-right text-red-400">{r.hard}</td>
                <td className="py-2.5 text-right text-gray-500">{r.modalRate}%</td>
                <td className={`py-2.5 text-right font-medium ${r.ctaRate >= 20 ? 'text-green-400' : 'text-gray-500'}`}>
                  {r.ctaRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Top friction */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Section title="Top páginas con fricción">
          {topPages.length === 0 ? <Empty /> : (
            <ul className="space-y-2">
              {topPages.map(([page, count]) => (
                <li key={page} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 font-mono text-xs truncate">{page}</span>
                  <span className="font-semibold text-gray-200 ml-2 shrink-0">{count}</span>
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
                    <a href={`/platform/tenants/${id}`} className="text-gray-200 font-medium truncate block hover:text-white">
                      {name}
                    </a>
                    <span className="text-xs text-gray-500 capitalize">{plan}</span>
                  </div>
                  <span className="font-semibold text-gray-200 ml-2 shrink-0">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Upgrade candidates */}
      <Section title="Candidatos a upgrade">
        {upgradeCandidates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Sin cuentas bloqueadas en los últimos 7 días</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-700">
                  <th className="pb-2 font-medium pl-2">Clínica</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium text-right">7d bloqueos</th>
                  <th className="pb-2 font-medium text-center">Gate</th>
                  <th className="pb-2 font-medium text-center">Uso máx.</th>
                  <th className="pb-2 font-medium text-center">CTA</th>
                  <th className="pb-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {upgradeCandidates.map((c) => (
                  <tr key={c.id} className="text-gray-300">
                    <td className="py-2.5 pl-2">
                      <a href={`/platform/tenants/${c.id}`} className="font-medium hover:text-white">{c.name}</a>
                      <div className="text-xs text-gray-600 font-mono">{c.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-2.5 capitalize text-gray-400">{c.plan}</td>
                    <td className="py-2.5 text-right font-bold text-white">{c.blocks7d}</td>
                    <td className="py-2.5 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        c.gate === 'hard' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'
                      }`}>
                        {c.gate}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      {c.maxPct > 0 ? (
                        <span className={`text-xs font-medium ${
                          c.maxPct >= 100 ? 'text-red-400' : c.maxPct >= 80 ? 'text-amber-400' : 'text-gray-500'
                        }`}>{c.maxPct}%</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="py-2.5 text-center">
                      {c.hasCta
                        ? <span className="text-green-400 font-medium">✓</span>
                        : <span className="text-gray-600">—</span>}
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
        <div className="text-center py-16 text-gray-600 text-sm">
          Sin eventos de fricción en los últimos 7 días.
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, sub, highlight, warn, danger }: {
  label: string; value: number; sub?: string
  highlight?: boolean; warn?: boolean; danger?: boolean
}) {
  const bg = danger    ? 'bg-red-950 border border-red-900'
           : warn      ? 'bg-amber-950 border border-amber-900'
           : highlight ? 'bg-gray-800 border border-gray-700'
                       : 'bg-gray-800 border border-gray-800'
  const valCls = danger    ? 'text-red-400'
               : warn      ? 'text-amber-400'
               : highlight ? 'text-white'
                           : 'text-gray-200'
  return (
    <div className={`rounded-xl p-4 text-center space-y-1 ${bg}`}>
      <p className={`text-2xl font-bold tabular-nums ${valCls}`}>{value}</p>
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300">{title}</h2>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-gray-500 text-center py-4">Sin datos</p>
}

function Alert({ level, message }: { level: 'danger' | 'warn' | 'info'; message: string }) {
  const cls = {
    danger: 'bg-red-950 border-red-900 text-red-300',
    warn:   'bg-amber-950 border-amber-900 text-amber-300',
    info:   'bg-blue-950 border-blue-900 text-blue-300',
  }[level]
  const icon = { danger: '●', warn: '●', info: 'i' }[level]
  return (
    <div className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 ${cls}`}>
      <span className="font-bold">{icon}</span>
      <span>{message}</span>
    </div>
  )
}

function RecomBadge({ r }: { r: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    upgrade_now:     { label: 'Upgrade ya',      cls: 'bg-red-900 text-red-300' },
    follow_up:       { label: 'Follow-up',       cls: 'bg-green-900 text-green-300' },
    mostrar_precios: { label: 'Mostrar precios', cls: 'bg-blue-900 text-blue-300' },
  }
  const { label, cls } = map[r] ?? { label: r, cls: 'bg-gray-800 text-gray-400' }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
  )
}
