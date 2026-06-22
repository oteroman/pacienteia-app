import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import { fetchReputationStats, type ReputationPeriod, type AlertRow } from '@/lib/analytics/reputation'

type SearchParams = Promise<{ period?: string }>

export default async function ReputationPage({ searchParams }: { searchParams: SearchParams }) {
  const { period: periodParam = '30d' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId    = await getActiveOrganizationId()
  const branchId = await getActiveBranchId()
  if (!orgId) redirect('/clinic-selector')

  const period = (['7d', '30d', '90d'] as ReputationPeriod[]).includes(periodParam as ReputationPeriod)
    ? (periodParam as ReputationPeriod)
    : '30d'

  const stats = await fetchReputationStats(orgId, branchId, period)

  const npsColor = stats.nps >= 50 ? 'text-lima-700' : stats.nps >= 0 ? 'text-amber-700' : 'text-red-600'
  const npsBg    = stats.nps >= 50 ? 'bg-lima-50 border-lima-200' : stats.nps >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  const ratingColor = stats.avgRating >= 4 ? 'text-lima-700' : stats.avgRating >= 3 ? 'text-amber-700' : 'text-red-600'
  const ratingBg    = stats.avgRating >= 4 ? 'bg-lima-50 border-lima-200' : stats.avgRating >= 3 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Reputación & Satisfacción</h1>
          <p className="text-sm text-slate mt-1">
            {stats.period.label} · encuestas post-cita y escudo de reseñas Google
          </p>
        </div>
        <div className="flex gap-1 bg-[#F3F6F9] rounded-lg p-1">
          {(['7d', '30d', '90d'] as ReputationPeriod[]).map((p) => (
            <Link key={p} href={`?period=${p}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p ? 'bg-white text-ink shadow-xs' : 'text-slate hover:text-slate'
              }`}>
              {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
            </Link>
          ))}
        </div>
      </div>

      {stats.followupsSent === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Encuestas enviadas"   value={stats.followupsSent}
              sub={`${stats.followupsResponded} respondidas (${stats.responseRate}%)`}
              color="text-brand-700" bg="bg-brand-50" border="border-brand-200" />

            <KpiCard label="Calificación promedio"
              value={stats.followupsResponded > 0 ? `${stats.avgRating} / 5` : '—'}
              sub={`${stats.promoters} excelentes · ${stats.detractors} negativas`}
              color={ratingColor} bg={ratingBg} border={ratingBg.split(' ')[1]} />

            <KpiCard label="Reseñas Google enviadas" value={stats.reviewLinksSent}
              sub="a pacientes con 4-5 estrellas"
              color="text-lima-700" bg="bg-lima-50" border="border-lima-200" />

            <KpiCard label="Alertas de riesgo"    value={stats.alertsCreated}
              sub="calificaron 1-3 estrellas"
              color={stats.alertsCreated > 0 ? 'text-red-600' : 'text-slate'}
              bg={stats.alertsCreated > 0 ? 'bg-red-50' : 'bg-mist'}
              border={stats.alertsCreated > 0 ? 'border-red-200' : 'border-fog'} />
          </div>

          {/* NPS banner */}
          {stats.followupsResponded > 0 && (
            <div className={`rounded-2xl border ${npsBg} px-5 py-4 flex items-center justify-between flex-wrap gap-4`}>
              <div>
                <p className="text-xs font-semibold text-slate uppercase tracking-wide">NPS simplificado</p>
                <p className={`text-3xl font-bold tabular-nums mt-1 ${npsColor}`}>{stats.nps > 0 ? '+' : ''}{stats.nps}</p>
                <p className="text-xs text-slate mt-0.5">
                  Promotores {stats.promoters} · Pasivos {stats.passives} · Detractores {stats.detractors}
                </p>
              </div>
              <div className="text-xs text-slate text-right">
                <p><strong className="text-slate">+50</strong> Excelente</p>
                <p><strong className="text-slate">0–49</strong> Bueno</p>
                <p><strong className="text-slate">&lt;0</strong> Requiere atención</p>
              </div>
            </div>
          )}

          {/* Two panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Rating distribution */}
            <section className="rounded-2xl border bg-white p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Distribución de calificaciones</h2>
                <p className="text-xs text-slate mt-0.5">¿Cómo calificaron los pacientes su atención?</p>
              </div>
              {stats.followupsResponded === 0 ? (
                <p className="text-xs text-slate italic">Sin respuestas aún.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.ratings.map(({ star, count }) => (
                    <RatingRow key={star} star={star} count={count} total={stats.followupsResponded} />
                  ))}
                </div>
              )}
            </section>

            {/* Escudo de reputación */}
            <section className="rounded-2xl border bg-white p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Escudo de reputación</h2>
                <p className="text-xs text-slate mt-0.5">Cómo el sistema protege y potencia tu imagen</p>
              </div>
              <div className="space-y-3">
                <ShieldRow
                  icon="🌟"
                  label="Reseñas Google enviadas"
                  value={stats.reviewLinksSent}
                  total={stats.promoters}
                  description="Pacientes con 4-5 estrellas que recibieron el link"
                  good
                />
                <ShieldRow
                  icon="⚠️"
                  label="Alertas internas creadas"
                  value={stats.alertsCreated}
                  total={stats.detractors + stats.passives}
                  description="Casos con 1-3 estrellas escalados al equipo"
                  good={false}
                />
              </div>
              <div className="pt-3 border-t border-fog">
                <p className="text-[11px] text-slate">
                  Pacientes insatisfechos <strong>NO</strong> reciben el link de Google — su feedback queda en privado para que el equipo lo resuelva.
                </p>
              </div>
            </section>
          </div>

          {/* Alerts table */}
          {stats.alerts.length > 0 && (
            <section className="rounded-2xl border bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Alertas de satisfacción — requieren seguimiento</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  {stats.alerts.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-mist border-b border-fog">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Paciente</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Calificación</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Tratamiento</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] whitespace-nowrap">Fecha cita</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Alerta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fog">
                    {stats.alerts.map((row) => (
                      <AlertTableRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Setup CTA if no Google URL */}
          <div className="rounded-2xl border border-dashed border-fog bg-white px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">¿Tienes la URL de Google Reviews configurada?</p>
              <p className="text-xs text-slate mt-0.5">
                Sin ella, los pacientes felices reciben gracias pero no el link para dejar reseña.
              </p>
            </div>
            <Link href="/settings/whatsapp"
              className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors whitespace-nowrap">
              Configurar →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-fog bg-white p-12 text-center">
      <p className="text-3xl mb-3">⭐</p>
      <p className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Sin encuestas enviadas aún</p>
      <p className="text-xs text-slate mt-1 max-w-sm mx-auto">
        Las encuestas se envían automáticamente 4h después de cada cita atendida.
        Activa el workflow en n8n y configura la URL de Google Reviews en Ajustes → WhatsApp.
      </p>
      <Link href="/settings/whatsapp"
        className="inline-block mt-4 text-sm font-medium text-brand-600 hover:text-brand-800">
        Configurar URL de reseñas →
      </Link>
    </div>
  )
}

function KpiCard({ label, value, sub, color, bg, border }: {
  label: string; value: string | number; sub?: string
  color: string; bg: string; border: string
}) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4`}>
      <p className="text-xs font-medium text-slate leading-tight">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-2 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate mt-1 leading-tight">{sub}</p>}
    </div>
  )
}

function RatingRow({ star, count, total }: { star: number; count: number; total: number }) {
  const pct   = total > 0 ? Math.round((count / total) * 100) : 0
  const stars = '★'.repeat(star) + '☆'.repeat(5 - star)
  const color = star >= 4 ? 'bg-green-400' : star === 3 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-amber-500 tracking-tighter text-sm">{stars}</span>
        <span className="font-semibold text-ink tabular-nums">
          {count} <span className="text-slate font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-[#F3F6F9] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ShieldRow({ icon, label, value, total, description, good }: {
  icon: string; label: string; value: number; total: number
  description: string; good: boolean
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className={`rounded-xl p-3 ${good ? 'bg-lima-50' : 'bg-amber-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate">{icon} {label}</span>
        <span className={`text-sm font-bold ${good ? 'text-lima-700' : 'text-amber-700'}`}>
          {value} <span className="text-xs font-normal text-slate">/ {total} ({pct}%)</span>
        </span>
      </div>
      <p className="text-[10px] text-slate">{description}</p>
    </div>
  )
}

const RATING_STAR: Record<number, string> = { 5: '🌟', 4: '😊', 3: '😐', 2: '😕', 1: '😞' }

function AlertTableRow({ row }: { row: AlertRow }) {
  const date = row.scheduledAt
    ? new Date(row.scheduledAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    : '—'
  return (
    <tr className="hover:bg-mist transition-colors">
      <td className="px-4 py-2.5 font-medium text-ink">{row.patientName.split(' ')[0]}</td>
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-1">
          <span className="text-base">{RATING_STAR[row.rating] ?? '⚠️'}</span>
          <span className="font-semibold text-red-600">{row.rating}/5</span>
        </span>
      </td>
      <td className="px-4 py-2.5 text-slate">{row.treatmentType ?? '—'}</td>
      <td className="px-4 py-2.5 text-slate whitespace-nowrap">{date}</td>
      <td className="px-4 py-2.5">
        {row.alertCreated
          ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Escalado</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3F6F9] text-slate">Pendiente</span>
        }
      </td>
    </tr>
  )
}
