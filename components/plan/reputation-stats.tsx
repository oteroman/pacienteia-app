import type { ReputationStats } from '@/lib/reputation/stats'

interface ReputationStatsCardProps {
  stats: ReputationStats
}

function ScoreDot({ score }: { score: number }) {
  const color =
    score >= 4.5 ? 'bg-green-500' :
    score >= 3.5 ? 'bg-yellow-400' :
    score > 0    ? 'bg-red-400' :
    'bg-gray-200'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
}

export function ReputationStatsCard({ stats }: ReputationStatsCardProps) {
  const {
    total_sent, avg_score, positive_count, negative_count,
    positive_pct, google_reviews_sent, alerts_sent, weekly_trend,
  } = stats

  const scoreColor =
    avg_score >= 4.5 ? 'text-green-700' :
    avg_score >= 3.5 ? 'text-yellow-700' :
    avg_score > 0    ? 'text-red-600' :
    'text-gray-400'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Escudo de Reputación — este mes</h2>
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
        <p className="text-xs text-gray-400 text-center py-2">
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
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Tendencia últimas 4 semanas</p>
          <div className="flex items-end gap-2">
            {weekly_trend.map((week) => (
              <div key={week.week} className="flex-1 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-600">
                    {week.avg > 0 ? week.avg : '—'}
                  </span>
                  <div
                    className="w-full rounded-t bg-brand-200"
                    style={{ height: `${week.avg > 0 ? (week.avg / 5) * 32 : 4}px`, minHeight: '4px' }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{week.week}</p>
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
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-brand-50' : alert ? 'bg-red-50' : 'bg-gray-50'}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-700' : alert ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className={`text-xs font-medium mt-0.5 ${highlight ? 'text-brand-600' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}
