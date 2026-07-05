import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import { fetchReminderStats, type ReminderPeriod, type ReminderRow } from '@/lib/analytics/reminders'
import { isFeatureAllowed } from '@/lib/plans/gating'

type SearchParams = Promise<{ period?: string }>

export default async function RemindersPage({ searchParams }: { searchParams: SearchParams }) {
  const { period: periodParam = '30d' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId    = await getActiveOrganizationId()
  const branchId = await getActiveBranchId()
  if (!orgId) redirect('/clinic-selector')

  const allowed = await isFeatureAllowed(orgId, 'advanced_confirmation')
  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-fog bg-white p-10 text-center space-y-4">
        <p className="text-3xl">📬</p>
        <h1 className="text-xl font-bold text-ink">Recordatorios & No-shows</h1>
        <p className="text-sm text-slate">
          Monitorea la efectividad de tus recordatorios WhatsApp y la tasa de no-shows. Disponible en el plan Pro.
        </p>
        <Link
          href="/pricing"
          className="inline-block mt-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          Ver plan Pro →
        </Link>
      </div>
    )
  }

  const period = (['7d', '30d', '90d'] as ReminderPeriod[]).includes(periodParam as ReminderPeriod)
    ? (periodParam as ReminderPeriod)
    : '30d'

  const stats = await fetchReminderStats(orgId, branchId, period)

  const hasData = stats.r24Total > 0 || stats.apptsTotal > 0

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header + period selector */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Recordatorios & No-shows</h1>
          <p className="text-sm text-slate mt-1">
            {stats.period.label} · efectividad de recordatorios WhatsApp y tasa de no-shows
          </p>
        </div>
        <div className="flex gap-1 bg-[#F3F6F9] rounded-lg p-1">
          {(['7d', '30d', '90d'] as ReminderPeriod[]).map((p) => (
            <Link
              key={p}
              href={`?period=${p}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p ? 'bg-white text-ink shadow-xs' : 'text-slate hover:text-slate'
              }`}
            >
              {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
            </Link>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Recordatorios 24h enviados"
              value={stats.r24Total}
              sub={stats.r2Total > 0 ? `+ ${stats.r2Total} recordatorios 2h` : 'Solo recordatorios del día anterior'}
              color="text-brand-700"
              bg="bg-brand-50"
              border="border-brand-200"
            />
            <KpiCard
              label="Tasa de confirmación"
              value={`${stats.confirmationRate}%`}
              sub={`${stats.r24Confirmed} confirmados · ${stats.r24Rescheduled} reagendaron`}
              color={stats.confirmationRate >= 60 ? 'text-lima-700' : stats.confirmationRate >= 30 ? 'text-amber-700' : 'text-red-600'}
              bg={stats.confirmationRate >= 60 ? 'bg-lima-50' : stats.confirmationRate >= 30 ? 'bg-amber-50' : 'bg-red-50'}
              border={stats.confirmationRate >= 60 ? 'border-lima-200' : stats.confirmationRate >= 30 ? 'border-amber-200' : 'border-red-200'}
            />
            <KpiCard
              label="No-shows en el período"
              value={stats.apptsNoShow}
              sub={`${stats.noShowRate}% de ${stats.apptsTotal} citas programadas`}
              color={stats.noShowRate <= 10 ? 'text-lima-700' : stats.noShowRate <= 20 ? 'text-amber-700' : 'text-red-600'}
              bg={stats.noShowRate <= 10 ? 'bg-lima-50' : stats.noShowRate <= 20 ? 'bg-amber-50' : 'bg-red-50'}
              border={stats.noShowRate <= 10 ? 'border-lima-200' : stats.noShowRate <= 20 ? 'border-amber-200' : 'border-red-200'}
            />
          </div>

          {/* Insight banner */}
          {stats.noShowRate > 20 && stats.r24Total === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
              <span className="text-lg mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Alta tasa de no-shows: {stats.noShowRate}%</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  No hay recordatorios enviados en este período. Activa el workflow en n8n para que los recordatorios se envíen automáticamente y reducir no-shows.
                </p>
              </div>
            </div>
          )}
          {stats.confirmationRate >= 70 && stats.r24Total > 0 && (
            <div className="rounded-2xl border border-lima-200 bg-lima-50 px-5 py-4 flex items-start gap-3">
              <span className="text-lg mt-0.5">✓</span>
              <div>
                <p className="text-sm font-semibold text-lima-700">Los recordatorios están funcionando bien</p>
                <p className="text-xs text-lima-700 mt-0.5">
                  {stats.confirmationRate}% de tus pacientes confirman por WhatsApp. El estándar de la industria es 55–65%.
                </p>
              </div>
            </div>
          )}

          {/* Two-panel section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Reminder funnel */}
            <section className="rounded-2xl border bg-white p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Funnel de respuestas (recordatorio 24h)</h2>
                <p className="text-xs text-slate mt-0.5">¿Qué hicieron los pacientes al recibir el recordatorio?</p>
              </div>
              {stats.r24Total === 0 ? (
                <p className="text-xs text-slate italic">Sin recordatorios en el período seleccionado.</p>
              ) : (
                <div className="space-y-2.5">
                  <FunnelRow label="Enviados"       value={stats.r24Total}       total={stats.r24Total} color="bg-gray-300" />
                  <FunnelRow label="Confirmaron ✓"  value={stats.r24Confirmed}   total={stats.r24Total} color="bg-green-400" />
                  <FunnelRow label="Reagendaron →"  value={stats.r24Rescheduled} total={stats.r24Total} color="bg-amber-400" />
                  <FunnelRow label="Sin respuesta"  value={stats.r24NoResponse}  total={stats.r24Total} color="bg-fog" />
                  {stats.r24Failed > 0 && (
                    <FunnelRow label="Error de envío" value={stats.r24Failed}    total={stats.r24Total} color="bg-red-300" />
                  )}
                </div>
              )}
            </section>

            {/* Appointment outcomes */}
            <section className="rounded-2xl border bg-white p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Resultado de citas en el período</h2>
                <p className="text-xs text-slate mt-0.5">Estado final de todas las citas programadas</p>
              </div>
              {stats.apptsTotal === 0 ? (
                <p className="text-xs text-slate italic">Sin citas en el período seleccionado.</p>
              ) : (
                <div className="space-y-2.5">
                  <FunnelRow label="Total programadas"  value={stats.apptsTotal}     total={stats.apptsTotal} color="bg-gray-300" />
                  <FunnelRow label="Atendidas"          value={stats.apptsCompleted} total={stats.apptsTotal} color="bg-green-400" />
                  <FunnelRow label="Inasistencias"      value={stats.apptsNoShow}    total={stats.apptsTotal} color="bg-red-400" />
                  <FunnelRow label="Canceladas"         value={stats.apptsCancelled} total={stats.apptsTotal} color="bg-orange-300" />
                  {(() => {
                    const other = stats.apptsTotal - stats.apptsCompleted - stats.apptsNoShow - stats.apptsCancelled
                    return other > 0 ? <FunnelRow label="Pendientes / otros" value={other} total={stats.apptsTotal} color="bg-blue-200" /> : null
                  })()}
                </div>
              )}
            </section>
          </div>

          {/* Recent reminders table */}
          {stats.recent.length > 0 && (
            <section className="rounded-2xl border bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-fog">
                <h2 className="text-sm font-semibold text-ink">Últimos recordatorios enviados</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-mist border-b border-fog">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Paciente</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] whitespace-nowrap">Fecha cita</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Tipo</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Respuesta</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado cita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fog">
                    {stats.recent.map((row) => (
                      <ReminderTableRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-fog bg-white p-12 text-center">
      <p className="text-3xl mb-3">📬</p>
      <p className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Sin recordatorios en este período</p>
      <p className="text-xs text-slate mt-1 max-w-xs mx-auto">
        Los recordatorios automáticos se envían vía n8n. Una vez activos, aquí verás confirmaciones, reagendamientos y su impacto en no-shows.
      </p>
    </div>
  )
}

function KpiCard({
  label, value, sub, color, bg, border,
}: {
  label: string; value: string | number; sub?: string
  color: string; bg: string; border: string
}) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-5`}>
      <p className="text-xs font-medium text-slate">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-2 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate mt-1">{sub}</p>}
    </div>
  )
}

function FunnelRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate">{label}</span>
        <span className="font-semibold text-ink tabular-nums">
          {value} <span className="text-slate font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-[#F3F6F9] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const REMINDER_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  confirmed:             { label: 'Confirmó', cls: 'bg-lima-100 text-lima-700' },
  reschedule_requested:  { label: 'Reagendó', cls: 'bg-amber-100 text-amber-700' },
  sent:                  { label: 'Sin respuesta', cls: 'bg-[#F3F6F9] text-slate' },
  failed:                { label: 'Error envío', cls: 'bg-red-100 text-red-600' },
}

const APPT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  completed:  { label: 'Atendida',      cls: 'text-lima-700' },
  no_show:    { label: 'Inasistencia',  cls: 'text-red-600 font-semibold' },
  cancelled:  { label: 'Cancelada',     cls: 'text-orange-600' },
  confirmed:  { label: 'Confirmada',    cls: 'text-blue-600' },
  scheduled:  { label: 'Programada',    cls: 'text-slate' },
}

function ReminderTableRow({ row }: { row: ReminderRow }) {
  const rs = REMINDER_STATUS_LABELS[row.reminderStatus] ?? { label: row.reminderStatus, cls: 'bg-[#F3F6F9] text-slate' }
  const as = APPT_STATUS_LABELS[row.appointmentStatus]  ?? { label: row.appointmentStatus, cls: 'text-slate' }

  const scheduledDate = row.scheduledAt
    ? new Date(row.scheduledAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

  const firstName = row.patientName.split(' ')[0]

  return (
    <tr className="hover:bg-mist transition-colors">
      <td className="px-4 py-2.5 font-medium text-ink">{firstName}</td>
      <td className="px-4 py-2.5 text-slate whitespace-nowrap">{scheduledDate}</td>
      <td className="px-4 py-2.5">
        <span className="px-1.5 py-0.5 rounded bg-[#F3F6F9] text-slate text-[10px] font-medium">
          {row.reminderType}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${rs.cls}`}>
          {rs.label}
        </span>
      </td>
      <td className={`px-4 py-2.5 ${as.cls}`}>{as.label}</td>
    </tr>
  )
}
