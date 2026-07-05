import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchAllClinicValue } from '@/lib/customer-health/value'
import type { ClinicValue } from '@/lib/customer-health/value'
import {
  deriveSignals, isExpansionSignal, isRenewalRiskSignal,
  SIGNAL_PLAYBOOKS, EXPANSION_SIGNALS, RENEWAL_RISK_SIGNALS,
} from '@/lib/customer-health/signals'
import type { Signal, SignalType } from '@/lib/customer-health/signals'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'
import { syncSignalTasks } from '@/app/actions/signals'

export default async function ValueDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const params = await searchParams
  const secret = process.env.ADMIN_DASHBOARD_SECRET
  if (!secret || params.key !== secret) notFound()

  const clinics = await fetchAllClinicValue()

  // Derive signals for every clinic
  const clinicSignals = clinics.map((c) => ({ clinic: c, signals: deriveSignals(c) }))

  const expansionClinics   = clinicSignals.filter((cs) => cs.signals.some((s) => isExpansionSignal(s.type)))
  const renewalRiskClinics = clinicSignals.filter((cs) => cs.signals.some((s) => isRenewalRiskSignal(s.type)))
  const severeRisk         = renewalRiskClinics.filter((cs) => cs.signals.some((s) => s.type === 'renewal_risk_severe'))

  const totalROI30d        = clinics.reduce((n, c) => n + c.roi.roi30d, 0)
  const totalROI7d         = clinics.reduce((n, c) => n + c.roi.roi7d, 0)
  const totalROIHistorical = clinics.reduce((n, c) => n + c.roi.roiHistorical, 0)
  const avgMultiplier      = clinics.length > 0
    ? clinics.reduce((n, c) => n + c.roi.multiplier, 0) / clinics.length
    : 0
  const roiPositive    = clinics.filter((c) => c.roi.multiplier >= 1)
  const lowToActivate  = clinics.filter((c) => c.isLowValueToActivate)

  // Weekly trend: if annualized 7d > 30d, trending up
  const trending = (totalROI7d * 4.3) > totalROI30d ? 'up' : 'flat'

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Value Dashboard</h1>
          <p className="text-sm text-slate mt-1">
            ROI estimado · {clinics.length} cuentas activas · datos en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/analytics/health?key=${params.key}`}
            className="text-xs text-slate hover:text-slate transition-colors"
          >
            ← Health
          </Link>
          <Link
            href={`/analytics/playbook?key=${params.key}`}
            className="text-xs text-slate hover:text-slate transition-colors"
          >
            Playbook →
          </Link>
          <span className="text-xs text-fog font-mono">internal</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="ROI total 7d"
          value={`S/ ${Math.round(totalROI7d).toLocaleString('es-PE')}`}
          color="green"
        />
        <SummaryCard
          label="ROI total 30d"
          value={`S/ ${Math.round(totalROI30d).toLocaleString('es-PE')}`}
          sub={trending === 'up' ? '↑ semana en alza' : undefined}
          color="green"
        />
        <SummaryCard
          label="ROI acumulado histórico"
          value={`S/ ${Math.round(totalROIHistorical).toLocaleString('es-PE')}`}
          sub="desde inicio de cuentas"
          color="blue"
        />
        <SummaryCard
          label="ROI promedio / plan"
          value={`${avgMultiplier.toFixed(1)}x`}
          sub={`${roiPositive.length} cuentas ≥ 1x`}
          color="blue"
        />
        <SummaryCard
          label="Para activar"
          value={lowToActivate.length}
          sub="score < 35"
          color={lowToActivate.length > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* ROI breakdown strip */}
      <ROIBreakdownStrip clinics={clinics} />

      {/* ── Expansion opportunities ── */}
      {expansionClinics.length > 0 && (
        <Section title={`Oportunidades de expansión (${expansionClinics.length})`} titleColor="blue">
          <p className="text-xs text-slate mb-4">
            Señales de upgrade o expansión activas. Priorizar contacto comercial.
          </p>
          <SignalTable rows={expansionClinics} signalFilter={EXPANSION_SIGNALS} />
        </Section>
      )}

      {/* ── Renewal risk ── */}
      {renewalRiskClinics.length > 0 && (
        <Section
          title={`Riesgo de renovación (${renewalRiskClinics.length})`}
          titleColor={severeRisk.length > 0 ? 'red' : 'amber'}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate">
              {severeRisk.length > 0 && (
                <span className="text-red-500 font-medium">{severeRisk.length} crítico{severeRisk.length !== 1 ? 's' : ''} · </span>
              )}
              Intervención recomendada antes del próximo ciclo de renovación.
            </p>
            <form action={syncSignalTasks}>
              <button
                type="submit"
                className="text-xs text-slate border border-fog px-2.5 py-1 rounded hover:bg-mist transition-colors"
              >
                ↻ Crear tareas automáticas
              </button>
            </form>
          </div>
          <SignalTable rows={renewalRiskClinics} signalFilter={RENEWAL_RISK_SIGNALS} />
        </Section>
      )}

      {/* All accounts */}
      <Section title="Todas las cuentas">
        {clinics.length === 0 ? (
          <p className="text-sm text-slate text-center py-8">
            Sin datos. Las cuentas aparecen aquí cuando tienen actividad registrada.
          </p>
        ) : (
          <ValueTable rows={clinics} />
        )}
      </Section>

      {/* Methodology footnote */}
      <div className="text-[11px] text-fog space-y-0.5 border-t pt-4">
        <p className="font-medium text-slate">Metodología de ROI (valores conservadores, mercado Lima):</p>
        <p>Lead recuperado S/ 150 · Cita confirmada S/ 80 · No-show evitado S/ 80 (vs 25% baseline industria) · Paciente reactivado S/ 200 · Tarea CS S/ 50</p>
        <p>Reactivado real: cita en los últimos 30d con gap previo ≥ 90 días. ROI 7d usa leads estimados (7/30 × mensual). ROI histórico: acumulado sin límite de fecha.</p>
        <p>Value score 0-100: leads 25 + citas 25 + no-show 15 + reactivados 15 + tareas 10 + actividad 10.</p>
      </div>

    </div>
  )
}

// ── Components ────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, color,
}: {
  label: string
  value: string | number
  sub?: string
  color: 'green' | 'blue' | 'amber' | 'red'
}) {
  const bg   = { green: 'bg-lima-50 border-green-100', blue: 'bg-blue-50 border-blue-100', amber: 'bg-amber-50 border-amber-100', red: 'bg-red-50 border-red-100' }
  const text = { green: 'text-lima-700', blue: 'text-blue-700', amber: 'text-amber-700', red: 'text-red-700' }
  return (
    <div className={`rounded-xl border p-4 ${bg[color]}`}>
      <p className="text-xs text-slate">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${text[color]}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({
  title, titleColor, children,
}: {
  title: string
  titleColor?: 'green' | 'blue' | 'amber' | 'red'
  children: React.ReactNode
}) {
  const border = {
    green: 'border-lima-200', blue: 'border-blue-200', amber: 'border-amber-200', red: 'border-red-200',
  }
  return (
    <section className={`border rounded-xl p-5 ${titleColor ? border[titleColor] : 'border-fog'}`}>
      <h2 className="text-sm font-semibold text-slate mb-4">{title}</h2>
      {children}
    </section>
  )
}

function ROIBreakdownStrip({ clinics }: { clinics: ClinicValue[] }) {
  const totals = clinics.reduce(
    (acc, c) => ({
      leads:        acc.leads        + c.roi.fromLeads,
      confirmed:    acc.confirmed    + c.roi.fromConfirmed,
      noShow:       acc.noShow       + c.roi.fromNoShow,
      reactivated:  acc.reactivated  + c.roi.fromReactivated,
      tasks:        acc.tasks        + c.roi.fromTasks,
    }),
    { leads: 0, confirmed: 0, noShow: 0, reactivated: 0, tasks: 0 }
  )
  const total = totals.leads + totals.confirmed + totals.noShow + totals.reactivated + totals.tasks
  if (total === 0) return null

  const items = [
    { label: 'Leads recuperados',      val: totals.leads,       color: 'bg-blue-400' },
    { label: 'Citas confirmadas',       val: totals.confirmed,   color: 'bg-green-400' },
    { label: 'No-shows evitados',       val: totals.noShow,      color: 'bg-teal-400' },
    { label: 'Pacientes reactivados',   val: totals.reactivated, color: 'bg-purple-400' },
    { label: 'Tareas CS',               val: totals.tasks,       color: 'bg-gray-400' },
  ].filter((i) => i.val > 0)

  return (
    <div className="rounded-xl border border-fog bg-mist p-4 space-y-3">
      <p className="text-xs font-medium text-slate">Composición del ROI (30d, todas las cuentas)</p>
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {items.map((item) => (
          <div
            key={item.label}
            className={`${item.color} rounded-sm`}
            style={{ width: `${Math.round((item.val / total) * 100)}%` }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${item.color}`} />
            <span className="text-[11px] text-slate">
              {item.label} · S/ {Math.round(item.val).toLocaleString('es-PE')} ({Math.round((item.val / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-400' : value >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#F3F6F9] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate">{value}</span>
    </div>
  )
}

function MultiplierBadge({ multiplier }: { multiplier: number }) {
  const label = `${multiplier.toFixed(1)}x`
  if (multiplier >= 2)   return <span className="inline-flex items-center gap-0.5 text-xs font-bold text-lima-700 bg-lima-50 px-1.5 py-0.5 rounded">{label}</span>
  if (multiplier >= 1)   return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{label}</span>
  if (multiplier >= 0.5) return <span className="text-xs text-amber-600">{label}</span>
  return <span className="text-xs text-slate">{label}</span>
}

const PLAN_BADGE: Record<string, string> = {
  trial:   'bg-[#F3F6F9] text-slate',
  basic:   'bg-slate-100 text-slate-700',
  pro:     'bg-blue-100 text-blue-700',
  premium: 'bg-ai-100 text-ai-600',
}

function PlanBadge({ plan }: { plan: string }) {
  const config = PLAN_CONFIG[plan as Plan]
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PLAN_BADGE[plan] ?? 'bg-[#F3F6F9] text-slate'}`}>
      {config?.name ?? plan}
    </span>
  )
}

function ScoreBreakdown({ score }: { score: ClinicValue['valueScore'] }) {
  const dims = [
    { label: 'Leads',    val: score.leads,     max: 25 },
    { label: 'Citas',    val: score.confirmed, max: 25 },
    { label: 'No-show',  val: score.noShow,    max: 15 },
    { label: 'Pacientes',val: score.patients,  max: 15 },
    { label: 'Tareas',   val: score.tasks,     max: 10 },
    { label: 'Actividad',val: score.activity,  max: 10 },
  ]
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
      {dims.map((d) => (
        <span key={d.label} className={`text-[10px] ${d.val < d.max * 0.5 ? 'text-amber-500' : 'text-slate'}`}>
          {d.label} {d.val}/{d.max}
        </span>
      ))}
    </div>
  )
}

// ── Signal badge ──────────────────────────────────────────────
const SIGNAL_BADGE_STYLE: Record<SignalType, string> = {
  upgrade_ready:          'bg-blue-100 text-blue-700',
  expansion_opportunity:  'bg-indigo-100 text-indigo-700',
  high_value_low_plan:    'bg-lima-100 text-lima-700',
  low_value_high_plan:    'bg-orange-100 text-orange-700',
  renewal_risk_mild:      'bg-amber-100 text-amber-700',
  renewal_risk_severe:    'bg-red-100 text-red-700 font-bold',
}

function SignalBadge({ type }: { type: SignalType }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${SIGNAL_BADGE_STYLE[type]}`}>
      {SIGNAL_PLAYBOOKS[type].label}
    </span>
  )
}

// ── Signal table (expansion / renewal risk sections) ──────────
function SignalTable({
  rows, signalFilter,
}: {
  rows: { clinic: ClinicValue; signals: Signal[] }[]
  signalFilter: SignalType[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-2">
      {rows.map(({ clinic, signals }) => {
        const relevant = signals.filter((s) => signalFilter.includes(s.type))
        const top = relevant[0]
        if (!top) return null
        const msg = top.messageTemplate
          .replace('[nombre]', clinic.clinicName)
          .replace('[roi]', `S/ ${Math.round(clinic.roi.roi30d).toLocaleString('es-PE')}`)
        return (
          <div key={clinic.clinicId} className="flex items-start gap-4 p-3 bg-white border border-fog rounded-lg hover:border-fog transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-ink text-sm">{clinic.clinicName}</span>
                <PlanBadge plan={clinic.plan} />
                {relevant.map((s) => <SignalBadge key={s.type} type={s.type} />)}
              </div>
              <p className="text-xs text-slate">{top.action}</p>
              <p className="text-xs text-slate mt-0.5 italic">&ldquo;{msg}&rdquo;</p>
              <p className="text-[10px] text-fog mt-1">
                Responsable: <span className="uppercase font-medium">{top.owner}</span> · SLA: {top.sla}
              </p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <div className="text-sm font-mono font-semibold text-ink">
                S/ {Math.round(clinic.roi.roi30d).toLocaleString('es-PE')}
              </div>
              <div className="text-[11px] text-slate">30d</div>
              <MultiplierBadge multiplier={clinic.roi.multiplier} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Full value table (all accounts) ──────────────────────────
function ValueTable({
  rows, compact = false,
}: {
  rows: ClinicValue[]
  compact?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate text-center py-6">Sin datos disponibles.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-slate text-left border-b">
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4">Clínica</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4">Plan</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4">Value score</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4 text-right">ROI 7d</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4 text-right">ROI 30d</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4 text-right">Histórico</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4 text-right">vs plan</th>
            {!compact && <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pr-4">Señales</th>}
            {!compact && <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Top driver</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-fog">
          {rows.map((c) => {
            const signals = deriveSignals(c)
            return (
              <tr key={c.clinicId} className="hover:bg-mist align-top">
                <td className="py-3 pr-4 font-medium text-ink whitespace-nowrap">
                  {c.clinicName}
                </td>
                <td className="py-3 pr-4">
                  <PlanBadge plan={c.plan} />
                </td>
                <td className="py-3 pr-4">
                  <ScoreBar value={c.valueScore.total} />
                  {!compact && <ScoreBreakdown score={c.valueScore} />}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-slate text-xs">
                  S/ {Math.round(c.roi.roi7d).toLocaleString('es-PE')}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-ink text-sm">
                  S/ {Math.round(c.roi.roi30d).toLocaleString('es-PE')}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-xs text-blue-600">
                  S/ {Math.round(c.roi.roiHistorical).toLocaleString('es-PE')}
                </td>
                <td className="py-3 pr-4 text-right">
                  <MultiplierBadge multiplier={c.roi.multiplier} />
                </td>
                {!compact && (
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {signals.map((s) => <SignalBadge key={s.type} type={s.type} />)}
                    </div>
                  </td>
                )}
                {!compact && (
                  <td className="py-3 text-xs text-slate max-w-[180px]">
                    {c.topAction}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
