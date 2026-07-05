import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  fetchRenewalSignals,
  SIGNAL_META,
  type SignalKey,
  type ClinicSignal,
} from '@/lib/analytics/signals'
import type { PeriodKey } from '@/lib/analytics/revenue'

type SearchParams = Promise<{ period?: string }>

const SIGNAL_ORDER: SignalKey[] = [
  'renewal_risk',
  'expansion_ready',
  'expansion_low_hanging',
  'healthy_renewal',
  'renewal_watch',
  'inactive',
]

export default async function RenewalPage({ searchParams }: { searchParams: SearchParams }) {
  const { period: p = '30d' } = await searchParams
  const period = (['week', '30d'] as PeriodKey[]).includes(p as PeriodKey) ? (p as PeriodKey) : '30d'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only platform admins can see cross-org renewal signals
  const isPlatformAdmin = !!(user.app_metadata?.platform_role)
  if (!isPlatformAdmin) redirect('/analytics')

  const signals = await fetchRenewalSignals(period)

  const bySignal = Object.fromEntries(
    SIGNAL_ORDER.map((k) => [k, signals.filter((s) => s.signal === k)]),
  ) as Record<SignalKey, ClinicSignal[]>

  const counts = Object.fromEntries(
    SIGNAL_ORDER.map((k) => [k, bySignal[k].length]),
  ) as Record<SignalKey, number>

  const atRisk    = counts.renewal_risk
  const expansion = counts.expansion_ready + counts.expansion_low_hanging

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Renovación & Expansión</h1>
          <p className="text-sm text-slate mt-1">Señales KPI para retención, upsell y prevención de churn</p>
        </div>
        <div className="flex items-center gap-3">
          {atRisk > 0 && (
            <span className="text-sm font-bold bg-red-600 text-white px-3 py-1.5 rounded-full">
              {atRisk} en riesgo
            </span>
          )}
          {expansion > 0 && (
            <span className="text-sm font-bold bg-green-600 text-white px-3 py-1.5 rounded-full">
              {expansion} listas para crecer
            </span>
          )}
          <div className="flex gap-1 bg-[#F3F6F9] rounded-lg p-1">
            {(['week', '30d'] as PeriodKey[]).map((pk) => (
              <Link
                key={pk}
                href={`?period=${pk}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === pk ? 'bg-white text-ink shadow-xs' : 'text-slate hover:text-slate'
                }`}
              >
                {pk === 'week' ? '7 días' : '30 días'}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {SIGNAL_ORDER.map((key) => {
          const meta = SIGNAL_META[key]
          return (
            <a key={key} href={`#${key}`}
              className="rounded-xl border bg-white p-3 text-center hover:shadow-xs transition-shadow">
              <p className={`text-2xl font-bold tabular-nums ${
                key === 'renewal_risk'       ? 'text-red-600' :
                key === 'expansion_ready'    ? 'text-lima-600' :
                key === 'expansion_low_hanging' ? 'text-emerald-600' :
                key === 'healthy_renewal'    ? 'text-blue-600' :
                key === 'renewal_watch'      ? 'text-amber-600' :
                'text-slate'
              }`}>{counts[key]}</p>
              <p className="text-[10px] text-slate mt-0.5 leading-tight">{meta.label}</p>
            </a>
          )
        })}
      </div>

      {/* Signal sections */}
      {SIGNAL_ORDER.map((key) => {
        const list = bySignal[key]
        if (list.length === 0) return null
        const meta = SIGNAL_META[key]

        return (
          <section key={key} id={key} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-ink">{meta.label}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
                {list.length}
              </span>
              <p className="text-[11px] text-slate hidden sm:block">{meta.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {list.map((s) => (
                <ClinicCard key={s.clinicId} signal={s} />
              ))}
            </div>
          </section>
        )
      })}

      {signals.length === 0 && (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <p className="text-slate text-sm">Sin clínicas activas en el período.</p>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────
function ClinicCard({ signal: s }: { signal: ClinicSignal }) {
  const meta = s.meta

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-fog">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{s.clinicName}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {s.reasons.map((r) => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F6F9] text-slate">{r}</span>
              ))}
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${meta.color}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* KPIs mini-grid */}
      <div className="grid grid-cols-3 divide-x divide-fog border-b border-fog">
        <KPICell label="Fill" value={`${s.kpis.fillRate}%`} alert={s.kpis.fillRate < 30} />
        <KPICell label="SLA"  value={`${s.kpis.slaMetRate}%`} alert={s.kpis.slaMetRate < 40} />
        <KPICell label="Score" value={String(s.kpis.score)} alert={s.kpis.score < 30} />
      </div>

      {/* Playbook + CTA */}
      <div className="px-4 py-3 space-y-2">
        <ol className="space-y-1">
          {s.playbook.slice(0, 2).map((step) => (
            <li key={step.step} className="flex gap-2 text-[11px] text-slate">
              <span className="font-bold text-slate flex-shrink-0">{step.step}.</span>
              <span>{step.action}</span>
            </li>
          ))}
        </ol>
        <Link
          href={`/analytics/revenue?clinic=${s.clinicId}`}
          className={`block text-center text-[11px] font-semibold py-1.5 rounded-lg transition-colors ${
            s.signal === 'renewal_risk'    ? 'bg-red-600 text-white hover:bg-red-700' :
            s.signal === 'expansion_ready' ? 'bg-green-600 text-white hover:bg-green-700' :
            'bg-[#F3F6F9] text-slate hover:bg-fog'
          }`}
        >
          {meta.cta} →
        </Link>
      </div>
    </div>
  )
}

function KPICell({ label, value, alert }: { label: string; value: string; alert: boolean }) {
  return (
    <div className="px-3 py-2 text-center">
      <p className="text-[10px] text-slate">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${alert ? 'text-red-500' : 'text-ink'}`}>{value}</p>
    </div>
  )
}
