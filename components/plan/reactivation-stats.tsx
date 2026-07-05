import type { ReactivationStats } from '@/lib/reactivation/stats'

interface ReactivationStatsCardProps {
  stats: ReactivationStats
}

export function ReactivationStatsCard({ stats }: ReactivationStatsCardProps) {
  const { contacted, responded, scheduled, ignored, response_rate_pct, revenue_recovered } = stats

  return (
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Reactivación Pro — este mes</h2>
        {revenue_recovered > 0 && (
          <span className="text-xs font-bold text-lima-700 bg-lima-50 border border-green-100 px-2.5 py-1 rounded-full">
            +S/{revenue_recovered.toLocaleString('es-PE')} estimados
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Contactados" value={contacted} />
        <Metric label="Respondieron" value={responded} sub={`${response_rate_pct}%`} highlight />
        <Metric label="Agendaron" value={scheduled} />
        <Metric label="Sin respuesta" value={ignored} muted />
      </div>

      {contacted === 0 && (
        <p className="text-xs text-slate text-center py-2">
          La campaña de reactivación aún no ha enviado mensajes este mes.
          Se ejecuta automáticamente cada lunes.
        </p>
      )}

      {contacted > 0 && revenue_recovered === 0 && (
        <p className="text-xs text-slate">
          Los ingresos recuperados aparecerán cuando un paciente confirme una nueva cita.
        </p>
      )}

      {revenue_recovered > 0 && (
        <div className="rounded-xl bg-lima-50 border border-green-100 px-4 py-3 text-sm text-lima-700">
          <strong>{scheduled} paciente{scheduled !== 1 ? 's' : ''}</strong> volvió a agendar
          × S/{((stats as { revenue_recovered: number } & ReactivationStats) && revenue_recovered / (scheduled || 1)).toFixed(0)} ticket promedio
          = <strong>S/{revenue_recovered.toLocaleString('es-PE')}</strong> recuperados este mes.
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  sub,
  highlight,
  muted,
}: {
  label: string
  value: number
  sub?: string
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-brand-50' : 'bg-mist'}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-700' : muted ? 'text-slate' : 'text-ink'}`}>
        {value}
      </p>
      <p className="text-xs text-slate mt-0.5">{label}</p>
      {sub && <p className={`text-xs font-medium mt-0.5 ${highlight ? 'text-brand-600' : 'text-slate'}`}>{sub}</p>}
    </div>
  )
}
