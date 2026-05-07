import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import {
  fetchClinicKPIsWithTrend,
  fetchNetworkBenchmarks,
  type PeriodKey,
  type ClinicKPIWithTrend,
  type NetworkBenchmarks,
} from '@/lib/analytics/revenue'
import { fetchClinicSignal, SIGNAL_META } from '@/lib/analytics/signals'

type SearchParams = Promise<{ period?: string }>

export default async function RevenuePage({ searchParams }: { searchParams: SearchParams }) {
  const { period: periodParam = '30d' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const period = (['week', 'month', '30d'] as PeriodKey[]).includes(periodParam as PeriodKey)
    ? (periodParam as PeriodKey)
    : '30d'

  const [kpi, benchmarks, signal] = await Promise.all([
    fetchClinicKPIsWithTrend(clinicId, period),
    fetchNetworkBenchmarks(period),
    fetchClinicSignal(clinicId, period),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header + period selector */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue & Rendimiento</h1>
          <p className="text-sm text-gray-500 mt-1">{kpi.period.label} · estimaciones basadas en citas y recuperaciones</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['week', 'month', '30d'] as PeriodKey[]).map((p) => (
            <Link
              key={p}
              href={`?period=${p}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'week' ? '7 días' : p === 'month' ? 'Este mes' : '30 días'}
            </Link>
          ))}
        </div>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RevenueCard
          label="Revenue realizado"
          value={kpi.revenueActual}
          sub={`${kpi.apptsCompleted} citas completadas`}
          trend={kpi.trends.revenueActual}
          color="text-green-700"
          bg="bg-green-50"
          border="border-green-200"
          isMoney
        />
        <RevenueCard
          label="Revenue recuperado"
          value={kpi.revenueRecovered}
          sub={`${kpi.rebooksSuccess} reagendados + ${kpi.slotsFilled} slots llenados`}
          trend={kpi.trends.revenueRecovered}
          color="text-blue-700"
          bg="bg-blue-50"
          border="border-blue-200"
          note="estimado"
          isMoney
        />
        <RevenueCard
          label="Revenue en riesgo"
          value={kpi.revenueAtRisk}
          sub={`${kpi.noShows} no-shows + ${kpi.cancellations} cancelaciones`}
          color="text-red-600"
          bg="bg-red-50"
          border="border-red-200"
          note="estimado"
          isMoney
        />
      </div>

      {/* Renewal signal card */}
      {signal && (
        <div className={`rounded-2xl border p-5 flex items-start justify-between gap-4 ${SIGNAL_META[signal.signal].color}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SIGNAL_META[signal.signal].color}`}>
                {SIGNAL_META[signal.signal].label}
              </span>
            </div>
            <p className="text-sm text-gray-700">{SIGNAL_META[signal.signal].description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {signal.reasons.map((r) => (
                <span key={r} className="text-[10px] px-2 py-0.5 rounded bg-white/60 text-gray-600">{r}</span>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 space-y-1">
            <p className="text-[11px] font-semibold text-gray-700">Acción sugerida:</p>
            <p className="text-[11px] text-gray-600">{signal.playbook[0]?.action}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Appointment funnel */}
        <section className="rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Embudo de citas</h2>
          <div className="space-y-2">
            <FunnelRow label="Creadas"     value={kpi.apptsCreated}   total={kpi.apptsCreated} color="bg-gray-200" />
            <FunnelRow label="Completadas" value={kpi.apptsCompleted} total={kpi.apptsCreated} color="bg-green-400" />
            <FunnelRow label="Canceladas"  value={kpi.cancellations}  total={kpi.apptsCreated} color="bg-red-400"  />
            <FunnelRow label="No-shows"    value={kpi.noShows}        total={kpi.apptsCreated} color="bg-orange-400" />
          </div>
          <p className="text-[11px] text-gray-400">
            Tasa de cancelación: <strong>{kpi.cancellationRate}%</strong>
            {' · '}
            Precio promedio: <strong>{fmt(kpi.avgPrice)}</strong>
          </p>
        </section>

        {/* Recovery KPIs */}
        <section className="rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Recuperación de slots</h2>
          <div className="space-y-3">
            <RateRow
              label="Fill rate (backfill)"
              value={kpi.fillRate}
              benchmark={benchmarks.medianFillRate}
              trend={kpi.trends.fillRate}
              detail={`${kpi.slotsFilled} de ${kpi.slotsOpened} slots`}
            />
            <RateRow
              label="Rebook rate"
              value={kpi.rebookRate}
              detail={`${kpi.rebooksSuccess} de ${kpi.rebooksTotal} rebookings`}
            />
          </div>

          <div className="pt-2 border-t border-gray-50">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">Intakes & SLA</h3>
            <div className="space-y-3">
              <RateRow
                label="SLA cumplido"
                value={kpi.slaMetRate}
                benchmark={benchmarks.medianSlaRate}
                trend={kpi.trends.slaMetRate}
                detail={`${kpi.slaMetCount} de ${kpi.slaTotalCount} con respuesta a tiempo`}
              />
              <RateRow
                label="Resolución de intakes"
                value={kpi.resolutionRate}
                detail={`${kpi.intakesResolved} de ${kpi.intakesTotal} resueltos`}
              />
            </div>
          </div>
        </section>

      </div>

      {/* Benchmark comparison */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">
          Tu clínica vs red anónima
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <BenchmarkCard
            label="Fill rate"
            yours={kpi.fillRate}
            network={benchmarks.medianFillRate}
          />
          <BenchmarkCard
            label="SLA cumplido"
            yours={kpi.slaMetRate}
            network={benchmarks.medianSlaRate}
          />
          <BenchmarkCard
            label="Revenue recuperado"
            yours={kpi.revenueRecovered}
            network={benchmarks.medianRecovered}
            isMoney
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Red = mediana entre todas las clínicas activas. No se comparte información identificable.
        </p>
      </section>

    </div>
  )
}

// ── Formatting ────────────────────────────────────────────────
function fmt(n: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n)
}

// ── Sub-components ────────────────────────────────────────────
function RevenueCard({
  label, value, sub, trend, color, bg, border, note, isMoney = false,
}: {
  label: string; value: number; sub?: string; trend?: 'up' | 'flat' | 'down'
  color: string; bg: string; border: string; note?: string; isMoney?: boolean
}) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'

  return (
    <div className={`rounded-2xl border ${border} ${bg} p-5`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <div className="flex items-center gap-1">
          {note && <span className="text-[9px] text-gray-400">{note}</span>}
          {trend && <span className={`text-sm font-bold ${trendColor}`}>{trendIcon}</span>}
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums mt-2 ${color}`}>
        {isMoney ? fmt(value) : `${value}%`}
      </p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function FunnelRow({
  label, value, total, color,
}: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function RateRow({
  label, value, benchmark, trend, detail,
}: { label: string; value: number; benchmark?: number; trend?: 'up' | 'flat' | 'down'; detail?: string }) {
  const trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null
  const trendColor = trend === 'up' ? 'text-green-600' : 'text-red-500'
  const bar        = Math.min(value, 100)

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
          {benchmark !== undefined && (
            <span className="text-gray-400">red {benchmark}%</span>
          )}
          <span className="font-semibold text-gray-800">
            {value}%
            {trendIcon && <span className={`ml-1 ${trendColor}`}>{trendIcon}</span>}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${value >= 70 ? 'bg-green-400' : value >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${bar}%` }}
        />
      </div>
      {detail && <p className="text-[10px] text-gray-400 mt-0.5">{detail}</p>}
    </div>
  )
}

function BenchmarkCard({
  label, yours, network, isMoney = false,
}: { label: string; yours: number; network: number; isMoney?: boolean }) {
  const delta   = network > 0 ? Math.round(((yours - network) / network) * 100) : 0
  const ahead   = delta >= 0
  const display = isMoney ? fmt : (n: number) => `${n}%`

  return (
    <div className="rounded-xl border bg-gray-50 p-4 space-y-2">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-400">Tu clínica</p>
          <p className="text-lg font-bold text-gray-900">{display(yours)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Red</p>
          <p className="text-sm font-semibold text-gray-500">{display(network)}</p>
        </div>
      </div>
      <p className={`text-[11px] font-semibold ${ahead ? 'text-green-600' : 'text-red-500'}`}>
        {ahead ? `+${delta}% sobre la red` : `${delta}% bajo la red`}
      </p>
    </div>
  )
}
