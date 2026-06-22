import type { ReputationStats } from '@/lib/reputation/stats'

interface ReputationStatsCardProps {
  stats: ReputationStats
}

function ScoreDot({ score }: { score: number }) {
  const color =
    score >= 4.5 ? 'bg-lima-500' :
    score >= 3.5 ? 'bg-yellow-400' :
    score > 0    ? 'bg-red-400' :
    'bg-fog'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
}

export function ReputationStatsCard({ stats }: ReputationStatsCardProps) {
  const {
    total_sent, avg_score, positive_count, negative_count,
    positive_pct, google_reviews_sent, alerts_sent, weekly_trend,
  } = stats

  const scoreColor =
    avg_score >= 4.5 ? 'text-lima-700' :
    avg_score >= 3.5 ? 'text-yellow-700' :
    avg_score > 0    ? 'text-red-600' :
    'text-slate'

  return (
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Escudo de Reputación — este mes</h2>
        {avg_score > 0 && (
          <div className="flex items-center gap-1.5">
            <ScoreDot score={avg_score} />
            <span className={`text-sm font-bold ${scoreColor}`}>{avg_score}/5</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Encuestas" value={total_sent} />
        <Metric label="Positivos" value={positive_count} sub={`${positive_pct}%`} highlight />
        <Metric label="Reseñas Google" value={google_reviews_sent} />
        <Metric label="Alertas" value={alerts_sent} alert={alerts_sent > 0} />
      </div>

      {total_sent === 0 && (
        <p className="text-xs text-slate text-center py-2">
          El Escudo de Reputación se activa automáticamente 2 horas después
          de cada cita completada.
        </p>
      )}

      {alerts_sent > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800">
          <strong>{alerts_sent} feedback{alerts_sent !== 1 ? 's' : ''} negativo{alerts_sent !== 1 ? 's' : ''}</strong> este mes.
          Revisa tu gestión de experiencia para prevenir reseñas negativas en Google.
        </div>
      )}

      {/* Weekly score trend */}
      {weekly_trend.some((w) => w.avg > 0) && (
        <div className="pt-2 border-t border-fog">
          <p className="text-xs text-slate mb-2">Tendencia últimas 4 semanas</p>
          <div className="flex items-end gap-2">
            {weekly_trend.map((week) => (
              <div key={week.week} className="flex-1 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-slate">
                    {week.avg > 0 ? week.avg : '—'}
                  </span>
                  <div
                    className="w-full rounded-t bg-brand-200"
                    style={{ height: `${week.avg > 0 ? (week.avg / 5) * 32 : 4}px`, minHeight: '4px' }}
                  />
                </div>
                <p className="text-xs text-slate mt-1">{week.week}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({
  label, value, sub, highlight, alert,
}: {
  label: string; value: number; sub?: string; highlight?: boolean; alert?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-brand-50' : alert ? 'bg-red-50' : 'bg-mist'}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-700' : alert ? 'text-red-600' : 'text-ink'}`}>
        {value}
      </p>
      <p className="text-xs text-slate mt-0.5">{label}</p>
      {sub && <p className={`text-xs font-medium mt-0.5 ${highlight ? 'text-brand-600' : 'text-slate'}`}>{sub}</p>}
    </div>
  )
}
