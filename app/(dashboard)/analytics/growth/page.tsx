import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'
import { isFeatureAllowed } from '@/lib/plans/gating'

interface MonthData {
  label: string          // "Ene 2025"
  yearMonth: string      // "2025-01"
  citas: number
  completed: number
  noShows: number
  revenue: number
  leads: number
  leadsConverted: number
  reactivaciones: number
}

interface PageProps {
  searchParams: Promise<{ months?: string }>
}

export default async function GrowthPage({ searchParams }: PageProps) {
  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId } = ctx

  const allowed = await isFeatureAllowed(organizationId, 'roi_dashboard')
  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-fog bg-white p-10 text-center space-y-4">
        <p className="text-3xl">📈</p>
        <h1 className="text-xl font-bold text-ink">Análisis de Crecimiento</h1>
        <p className="text-sm text-slate">
          Visualiza tus ingresos, citas completadas y reactivaciones mes a mes. Disponible en el plan Premium.
        </p>
        <Link
          href="/pricing"
          className="inline-block mt-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          Ver plan Premium →
        </Link>
      </div>
    )
  }

  const { months: monthsParam } = await searchParams
  const months = monthsParam === '6' ? 6 : monthsParam === '12' ? 12 : 3

  const sb = createAdminClient() as any

  // Organization start date
  const { data: org } = await sb
    .from('organizations')
    .select('created_at, name')
    .eq('id', organizationId)
    .single()

  const orgCreatedAt = org?.created_at ? new Date(org.created_at) : new Date()

  // Build last N months list
  const now = new Date()
  const monthList: { year: number; month: number; start: string; end: string; label: string; yearMonth: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
    monthList.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      start,
      end,
      label: d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }),
      yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }

  const startRange = monthList[0].start
  const endRange   = monthList[monthList.length - 1].end

  const [aptsRes, leadsRes, reactRes] = await Promise.all([
    sb.from('appointments')
      .select('scheduled_at, status, price')
      .eq('organization_id', organizationId)
      .gte('scheduled_at', startRange)
      .lte('scheduled_at', endRange),

    sb.from('intakes')
      .select('created_at, patient_id, status')
      .eq('organization_id', organizationId)
      .gte('created_at', startRange)
      .lte('created_at', endRange),

    sb.from('reactivation_campaigns')
      .select('updated_at, status')
      .eq('organization_id', organizationId)
      .eq('status', 'responded')
      .gte('updated_at', startRange)
      .lte('updated_at', endRange),
  ])

  const apts   = (aptsRes.data ?? []) as { scheduled_at: string; status: string; price: number | null }[]
  const leads  = (leadsRes.data ?? []) as { created_at: string; patient_id: string | null; status: string }[]
  const reacts = (reactRes.data ?? []) as { updated_at: string; status: string }[]

  function toYM(iso: string) {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const rows: MonthData[] = monthList.map(m => {
    const monthApts   = apts.filter(a => toYM(a.scheduled_at) === m.yearMonth)
    const monthLeads  = leads.filter(l => toYM(l.created_at) === m.yearMonth)
    const monthReacts = reacts.filter(r => toYM(r.updated_at) === m.yearMonth)

    const completed  = monthApts.filter(a => a.status === 'completed').length
    const noShows    = monthApts.filter(a => a.status === 'no_show').length
    const revenue    = monthApts
      .filter(a => a.status === 'completed' && a.price != null)
      .reduce((s, a) => s + (a.price ?? 0), 0)
    const converted  = monthLeads.filter(l => l.patient_id != null || l.status === 'resolved').length

    return {
      label:          m.label,
      yearMonth:      m.yearMonth,
      citas:          monthApts.length,
      completed,
      noShows,
      revenue,
      leads:          monthLeads.length,
      leadsConverted: converted,
      reactivaciones: monthReacts.length,
    }
  })

  // Totals and deltas
  const first = rows[0]
  const last  = rows[rows.length - 1]

  const totalRevenue      = rows.reduce((s, r) => s + r.revenue, 0)
  const totalCompleted    = rows.reduce((s, r) => s + r.completed, 0)
  const totalNoShows      = rows.reduce((s, r) => s + r.noShows, 0)
  const totalReacts       = rows.reduce((s, r) => s + r.reactivaciones, 0)
  const totalLeads        = rows.reduce((s, r) => s + r.leads, 0)
  const totalConverted    = rows.reduce((s, r) => s + r.leadsConverted, 0)

  const revenueGrowth = first.revenue > 0
    ? Math.round(((last.revenue - first.revenue) / first.revenue) * 100)
    : null
  const citasGrowth   = first.citas > 0
    ? Math.round(((last.citas - first.citas) / first.citas) * 100)
    : null

  // Bar chart helpers
  const maxRevenue  = Math.max(...rows.map(r => r.revenue), 1)
  const maxCitas    = Math.max(...rows.map(r => r.citas), 1)

  const monthsSinceStart = Math.max(1,
    Math.floor((now.getTime() - orgCreatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30))
  )

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Tu crecimiento</h1>
          <p className="text-sm text-slate mt-1">
            {monthsSinceStart} {monthsSinceStart === 1 ? 'mes' : 'meses'} usando PacienteIA ·{' '}
            {first.label} → {last.label}
          </p>
        </div>
        <div className="flex gap-1.5">
          {([3, 6, 12] as const).map(n => (
            <a
              key={n}
              href={`?months=${n}`}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors ${
                months === n
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate border-fog hover:bg-mist'
              }`}
            >
              {n}m
            </a>
          ))}
        </div>
      </div>

      {/* Hero KPIs acumulados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroKpi
          label="Ingresos totales"
          value={`S/ ${totalRevenue.toLocaleString('es-PE')}`}
          sub={revenueGrowth !== null
            ? revenueGrowth >= 0
              ? `+${revenueGrowth}% vs inicio`
              : `${revenueGrowth}% vs inicio`
            : `${totalCompleted} citas completadas`}
          subColor={revenueGrowth !== null && revenueGrowth > 0 ? 'text-lima-600' : 'text-slate'}
          accent="brand"
        />
        <HeroKpi
          label="Citas completadas"
          value={totalCompleted.toLocaleString('es-PE')}
          sub={citasGrowth !== null
            ? citasGrowth >= 0 ? `+${citasGrowth}% vs inicio` : `${citasGrowth}% vs inicio`
            : `${months} meses`}
          subColor={citasGrowth !== null && citasGrowth > 0 ? 'text-lima-600' : 'text-slate'}
          accent="brand"
        />
        <HeroKpi
          label="Pacientes reactivados"
          value={totalReacts.toLocaleString('es-PE')}
          sub={totalReacts > 0
            ? `S/ ${(totalReacts * 120).toLocaleString('es-PE')} estimado`
            : 'Campaña activa'}
          subColor={totalReacts > 0 ? 'text-lima-600' : 'text-slate'}
          accent="lima"
        />
        <HeroKpi
          label="Consultas convertidas"
          value={totalConverted.toLocaleString('es-PE')}
          sub={totalLeads > 0
            ? `${Math.round((totalConverted / totalLeads) * 100)}% de ${totalLeads} consultas`
            : 'Sin consultas aún'}
          subColor="text-slate"
          accent="brand"
        />
      </div>

      {/* Barras de ingresos por mes */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
        <h2 className="text-base font-semibold text-ink mb-1">Ingresos por mes</h2>
        <p className="text-xs text-slate mb-5">Basado en citas completadas con precio registrado</p>
        <div className="flex items-end gap-2 h-32">
          {rows.map((r, i) => {
            const isLast    = i === rows.length - 1
            const isFirst   = i === 0
            const pct       = maxRevenue > 0 ? (r.revenue / maxRevenue) * 100 : 0
            const prevRev   = i > 0 ? rows[i - 1].revenue : r.revenue
            const growing   = r.revenue >= prevRev
            return (
              <div key={r.yearMonth} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full flex items-end justify-center h-24">
                  {r.revenue > 0 && (
                    <div
                      className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity
                                 bg-ink/80 text-white text-[10px] font-mono rounded-md px-1.5 py-1 text-center z-10
                                 -translate-y-7 pointer-events-none"
                    >
                      S/ {r.revenue.toLocaleString('es-PE')}
                    </div>
                  )}
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      isLast   ? 'bg-brand-500' :
                      isFirst  ? 'bg-brand-200' :
                      growing  ? 'bg-brand-300' :
                                 'bg-brand-200'
                    }`}
                    style={{ height: `${Math.max(pct, r.revenue > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight ${
                  isLast ? 'text-brand-600' : 'text-slate'
                }`}>
                  {r.label.split(' ')[0]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Barras de citas + barra inicio vs ahora */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Citas por mes */}
        <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
          <h2 className="text-base font-semibold text-ink mb-1">Citas por mes</h2>
          <p className="text-xs text-slate mb-5">Total agendadas vs completadas</p>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const isLast = i === rows.length - 1
              const pct    = maxCitas > 0 ? (r.citas / maxCitas) * 100 : 0
              const cmpPct = r.citas > 0 ? (r.completed / r.citas) * 100 : 0
              return (
                <div key={r.yearMonth} className="flex items-center gap-3">
                  <span className={`text-[11px] w-14 shrink-0 ${isLast ? 'text-brand-600 font-semibold' : 'text-slate'}`}>
                    {r.label.split(' ')[0]}
                  </span>
                  <div className="flex-1 h-5 bg-mist rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-brand-100 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${isLast ? 'bg-brand-500' : 'bg-brand-300'}`}
                      style={{ width: `${cmpPct * pct / 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate w-14 text-right shrink-0 font-mono">
                    {r.completed}/{r.citas}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-slate mt-3">Completadas / Total agendadas</p>
        </div>

        {/* No-shows + Reactivaciones */}
        <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
          <h2 className="text-base font-semibold text-ink mb-1">Retención y recuperación</h2>
          <p className="text-xs text-slate mb-5">No-shows e inactivos recuperados</p>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const isLast    = i === rows.length - 1
              const totalCitas = Math.max(r.citas, 1)
              const noShowPct  = Math.round((r.noShows / totalCitas) * 100)
              return (
                <div key={r.yearMonth} className="flex items-center gap-3">
                  <span className={`text-[11px] w-14 shrink-0 ${isLast ? 'text-brand-600 font-semibold' : 'text-slate'}`}>
                    {r.label.split(' ')[0]}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-mist rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${noShowPct > 20 ? 'bg-red-400' : noShowPct > 10 ? 'bg-amber-400' : 'bg-lima-400'}`}
                        style={{ width: `${Math.min(noShowPct * 2, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate w-10 font-mono">{noShowPct}% NS</span>
                  </div>
                  {r.reactivaciones > 0 && (
                    <span className="text-[10px] text-lima-600 font-semibold shrink-0">
                      +{r.reactivaciones} react.
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-slate mt-3">NS = tasa de no-shows · react. = pacientes reactivados</p>
        </div>
      </div>

      {/* Tabla completa mes a mes */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-fog">
          <h2 className="text-base font-semibold text-ink">Detalle mes a mes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fog bg-mist">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Mes</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Ingresos</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Citas</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Completadas</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">No-shows</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Consultas</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Convertidos</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Reactivados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {rows.map((r, i) => {
                const isLast    = i === rows.length - 1
                const prevRev   = i > 0 ? rows[i - 1].revenue : null
                const revDelta  = prevRev !== null && prevRev > 0
                  ? Math.round(((r.revenue - prevRev) / prevRev) * 100)
                  : null

                return (
                  <tr
                    key={r.yearMonth}
                    className={`transition-colors ${isLast ? 'bg-brand-50' : 'hover:bg-mist'}`}
                  >
                    <td className={`px-4 py-3 font-medium ${isLast ? 'text-brand-700' : 'text-ink'}`}>
                      {r.label}
                      {isLast && (
                        <span className="ml-2 text-[10px] font-normal text-brand-500">actual</span>
                      )}
                      {i === 0 && (
                        <span className="ml-2 text-[10px] font-normal text-slate">inicio</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      <span className={r.revenue > 0 ? 'text-ink' : 'text-fog'}>
                        {r.revenue > 0 ? `S/ ${r.revenue.toLocaleString('es-PE')}` : '—'}
                      </span>
                      {revDelta !== null && (
                        <span className={`ml-1.5 text-[10px] font-medium ${revDelta > 0 ? 'text-lima-600' : revDelta < 0 ? 'text-red-500' : 'text-slate'}`}>
                          {revDelta > 0 ? `+${revDelta}%` : revDelta < 0 ? `${revDelta}%` : '='}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate font-mono">{r.citas || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={r.completed > 0 ? 'text-lima-600 font-medium' : 'text-fog'}>
                        {r.completed || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={r.noShows > 0 ? 'text-red-500' : 'text-fog'}>
                        {r.noShows > 0 ? r.noShows : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate font-mono">{r.leads || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={r.leadsConverted > 0 ? 'text-brand-600 font-medium' : 'text-fog'}>
                        {r.leadsConverted || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={r.reactivaciones > 0 ? 'text-lima-600 font-medium' : 'text-fog'}>
                        {r.reactivaciones > 0 ? `+${r.reactivaciones}` : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-fog bg-mist">
                <td className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Total {months}m</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                  S/ {totalRevenue.toLocaleString('es-PE')}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                  {rows.reduce((s, r) => s + r.citas, 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-lima-600">
                  {totalCompleted}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-red-500">
                  {totalNoShows > 0 ? totalNoShows : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                  {totalLeads || '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-brand-600">
                  {totalConverted || '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-lima-600">
                  {totalReacts > 0 ? `+${totalReacts}` : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Nota metodológica */}
      <p className="text-xs text-slate">
        Ingresos calculados sobre citas con precio registrado. Reactivados = pacientes que respondieron la campaña de reactivación.
        Convertidos = leads que generaron una cita o fueron marcados como resueltos.
      </p>
    </div>
  )
}

function HeroKpi({
  label, value, sub, subColor, accent,
}: {
  label: string
  value: string
  sub: string
  subColor: string
  accent: 'brand' | 'lima'
}) {
  const accentCls = accent === 'lima' ? 'text-lima-600' : 'text-brand-600'
  return (
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-5">
      <p className="text-xs text-slate">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accentCls}`}>{value}</p>
      <p className={`text-xs mt-1.5 ${subColor}`}>{sub}</p>
    </div>
  )
}
