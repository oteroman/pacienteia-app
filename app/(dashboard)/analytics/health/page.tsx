import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchAllClinicHealth } from '@/lib/customer-health'
import type { ClinicHealth, AlertType, HealthStatus } from '@/lib/customer-health'

// ── Access guard ─────────────────────────────────────────────
export default async function HealthDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const params = await searchParams
  const secret = process.env.ADMIN_DASHBOARD_SECRET
  if (!secret || params.key !== secret) notFound()

  const clinics = await fetchAllClinicHealth()
  const totalAlerts = clinics.reduce((n, c) => n + c.alerts.length, 0)

  // ── Derived views ─────────────────────────────────────────
  const atRisk   = clinics.filter((c) => c.healthStatus === 'at_risk' || c.healthStatus === 'churned')
  const watching = clinics.filter((c) => c.healthStatus === 'watch')
  const healthy  = clinics.filter((c) => c.healthStatus === 'healthy')
  const upgradeReady = clinics.filter((c) => c.alerts.includes('upgrade_ready'))

  const topAtRisk   = [...atRisk].slice(0, 5)
  const topUpgrade  = [...upgradeReady].sort((a, b) => b.score.total - a.score.total).slice(0, 5)
  const allByScore  = [...clinics].sort((a, b) => a.score.total - b.score.total)

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Salud del cliente</h1>
          <p className="text-sm text-slate mt-1">
            Score 0-100 · {clinics.length} cuentas activas · datos en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/analytics/value?key=${params.key}`}
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            Value →
          </Link>
          {totalAlerts > 0 && (
            <Link
              href={`/analytics/playbook?key=${params.key}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-full transition-colors"
            >
              {totalAlerts} tarea{totalAlerts !== 1 ? 's' : ''} pendiente{totalAlerts !== 1 ? 's' : ''} →
            </Link>
          )}
          <span className="text-xs text-fog font-mono">internal</span>
        </div>
      </div>

      {/* A. Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="En riesgo"      value={atRisk.length}     color="red"   />
        <SummaryCard label="Vigilar"         value={watching.length}   color="amber" />
        <SummaryCard label="Saludables"      value={healthy.length}    color="green" />
        <SummaryCard label="Listo a upgrade" value={upgradeReady.length} color="blue" />
      </div>

      {/* B. At risk */}
      {topAtRisk.length > 0 && (
        <Section title="Cuentas en riesgo" titleColor="red">
          <ClinicTable rows={topAtRisk} />
        </Section>
      )}

      {/* C. Upgrade candidates */}
      {topUpgrade.length > 0 && (
        <Section title="Listos para upgrade" titleColor="green">
          <ClinicTable rows={topUpgrade} />
        </Section>
      )}

      {/* D. All accounts */}
      <Section title="Todas las cuentas">
        {clinics.length === 0 ? (
          <p className="text-sm text-slate text-center py-6">
            Sin datos. Las clínicas aparecen aquí cuando tienen actividad registrada.
          </p>
        ) : (
          <ClinicTable rows={allByScore} showScoreBreakdown />
        )}
      </Section>
    </div>
  )
}

// ── Score breakdown popup via title attr ─────────────────────
function ClinicTable({ rows, showScoreBreakdown = false }: {
  rows: ClinicHealth[]
  showScoreBreakdown?: boolean
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left text-slate border-b border-fog">
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] pl-2">Clínica</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-center">Score</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-center">Estado</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-right">Uso leads</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] text-right">Citas trend</th>
            <th className="pb-2 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Alertas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-fog">
          {rows.map((c) => (
            <tr key={c.clinicId} className="text-ink hover:bg-mist/50">
              <td className="py-3 pl-2">
                <div className="font-medium leading-tight">{c.clinicName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PlanBadge plan={c.plan} />
                  {c.lastActivityDays > 14 && (
                    <span className="text-xs text-slate">
                      · sin actividad hace {c.lastActivityDays}d
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 text-center">
                <ScoreCell score={c.score} />
              </td>
              <td className="py-3 text-center">
                <StatusBadge status={c.healthStatus} />
              </td>
              <td className="py-3 text-right">
                <UsageCell pct={c.leadsUsedPct} />
              </td>
              <td className="py-3 text-right">
                <TrendCell trend={c.apptTrend} />
              </td>
              <td className="py-3">
                <div className="flex flex-wrap gap-1">
                  {c.alerts.map((a) => (
                    <AlertBadge key={a} alert={a} />
                  ))}
                  {c.alerts.length === 0 && (
                    <span className="text-xs text-fog">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── UI components ─────────────────────────────────────────────

function SummaryCard({ label, value, color }: {
  label: string; value: number
  color: 'red' | 'amber' | 'green' | 'blue'
}) {
  const bg = { red: 'bg-red-50 border-red-100', amber: 'bg-amber-50 border-amber-100', green: 'bg-lima-50 border-green-100', blue: 'bg-blue-50 border-blue-100' }[color]
  const vc = { red: 'text-red-700', amber: 'text-amber-700', green: 'text-lima-700', blue: 'text-blue-700' }[color]
  return (
    <div className={`rounded-xl p-4 text-center space-y-1 border ${bg}`}>
      <p className={`text-3xl font-bold tabular-nums ${vc}`}>{value}</p>
      <p className="text-xs text-slate leading-tight">{label}</p>
    </div>
  )
}

function Section({ title, titleColor = 'gray', children }: {
  title: string; titleColor?: 'red' | 'green' | 'gray'; children: React.ReactNode
}) {
  const tc = { red: 'text-red-700', green: 'text-lima-700', gray: 'text-slate' }[titleColor]
  return (
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-4">
      <h2 className={`text-sm font-semibold ${tc}`}>{title}</h2>
      {children}
    </div>
  )
}

function ScoreCell({ score }: { score: ClinicHealth['score'] }) {
  const total = score.total
  const barColor = total >= 70 ? 'bg-lima-500' : total >= 45 ? 'bg-amber-400' : 'bg-red-500'
  const breakdown = [
    `Recencia: ${score.recency}/20`,
    `Volumen: ${score.volume}/20`,
    `Calidad: ${score.quality}/20`,
    `Crecimiento: ${score.growth}/20`,
    `Fricción: ${score.friction}/20`,
  ].join(' · ')

  return (
    <div className="flex flex-col items-center gap-1" title={breakdown}>
      <span className="text-base font-bold tabular-nums">{total}</span>
      <div className="w-14 h-1.5 bg-[#F3F6F9] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${total}%` }} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const map: Record<HealthStatus, { label: string; cls: string }> = {
    healthy:  { label: 'Saludable', cls: 'bg-lima-50 text-lima-700' },
    watch:    { label: 'Vigilar',   cls: 'bg-amber-50 text-amber-700' },
    at_risk:  { label: 'En riesgo', cls: 'bg-red-50 text-red-700' },
    churned:  { label: 'Inactivo',  cls: 'bg-[#F3F6F9] text-slate' },
  }
  const { label, cls } = map[status]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

function PlanBadge({ plan }: { plan: string }) {
  const cls = plan === 'premium' ? 'bg-ai-50 text-ai-600'
            : plan === 'pro'     ? 'bg-blue-50 text-blue-700'
            : plan === 'basic'   ? 'bg-[#F3F6F9] text-slate'
                                 : 'bg-mist text-slate'
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${cls}`}>{plan}</span>
}

function UsageCell({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs text-fog">—</span>
  const cls = pct >= 90 ? 'text-red-600' : pct >= 75 ? 'text-amber-600' : 'text-slate'
  return <span className={`text-sm font-medium ${cls}`}>{pct}%</span>
}

function TrendCell({ trend }: { trend: number }) {
  if (trend === 0) return <span className="text-xs text-fog">→ estable</span>
  const up = trend > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-lima-600' : 'text-red-500'}`}>
      {up ? '↑' : '↓'} {Math.abs(trend)}%
    </span>
  )
}

function AlertBadge({ alert }: { alert: AlertType }) {
  const map: Record<AlertType, { label: string; cls: string }> = {
    at_risk:       { label: 'En riesgo',      cls: 'bg-red-50 text-red-600' },
    churned:       { label: 'Inactivo',       cls: 'bg-[#F3F6F9] text-slate' },
    inactive:      { label: 'Sin actividad',  cls: 'bg-[#F3F6F9] text-slate' },
    declining:     { label: 'Caída',          cls: 'bg-red-50 text-red-600' },
    high_friction: { label: 'Alta fricción',  cls: 'bg-orange-50 text-orange-600' },
    upgrade_ready: { label: 'Upgrade ↑',      cls: 'bg-lima-50 text-lima-700' },
  }
  const { label, cls } = map[alert]
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
}
