import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'
import { redirect } from 'next/navigation'
import { getOnboardingProgress } from '@/lib/plans/onboarding'
import { OnboardingChecklist } from '@/components/plan/onboarding-checklist'
import { fetchRevenueOpportunities } from '@/lib/analytics/opportunities'

interface AppointmentRow {
  id: string
  treatment_type: string
  scheduled_at: string
  status: string
  price: number | null
  patients:      { full_name: string } | null
  professionals: { name: string; color: string } | null
}

interface ConvPreview {
  id: string
  contact_name: string | null
  contact_phone: string
  unread_count: number
  last_message_preview: string | null
  last_message_at: string | null
}

interface ReactivationRow {
  id: string
  updated_at: string
  patients: { full_name: string; phone: string | null } | null
}

interface AtRiskPatient {
  id: string
  full_name: string
  last_visit_date: string | null
  retention_score: number | null
}

export default async function DashboardPage() {
  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId, branchId } = ctx

  const today          = new Date().toISOString().split('T')[0]
  const monthStart     = `${today.slice(0, 7)}-01`
  const twoHoursAgo    = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo   = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [onboarding, aptRes, convRes, tasksRes, staleLeadsRes, repRes, newLeadsRes, reactivationRes, atRiskRes, opportunities, recoveredRes] =
    await Promise.all([
      getOnboardingProgress(organizationId),

      // Citas de hoy (con precio para ingresos y profesional)
      sb.from('appointments')
        .select('id, treatment_type, scheduled_at, status, price, patients(full_name), professionals(name, color)')
        .eq('organization_id', organizationId)
        .gte('scheduled_at', `${today}T00:00:00`)
        .lte('scheduled_at', `${today}T23:59:59`)
        .order('scheduled_at'),

      // Conversaciones con mensajes sin leer
      sb.from('conversations')
        .select('id, contact_name, contact_phone, unread_count, last_message_preview, last_message_at')
        .eq('organization_id', organizationId)
        .eq('branch_id', branchId)
        .gt('unread_count', 0)
        .order('last_message_at', { ascending: false })
        .limit(3),

      // Tareas urgentes (alerta)
      sb.from('copilot_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'open')
        .eq('priority', 'high'),

      // Leads sin contactar >2h (alerta SLA)
      sb.from('intake_items')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'new')
        .lt('created_at', twoHoursAgo),

      // Alertas de reputación esta semana (alerta)
      sb.from('appointment_followups')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('alert_created', true)
        .gte('sent_at', sevenDaysAgo),

      // Leads nuevos hoy (KPI)
      sb.from('intake_items')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'new')
        .gte('created_at', `${today}T00:00:00`),

      // Últimas reactivaciones respondidas (actividad reciente)
      sb.from('reactivation_campaigns')
        .select('id, updated_at, patients(full_name, phone)')
        .eq('organization_id', organizationId)
        .eq('status', 'responded')
        .order('updated_at', { ascending: false })
        .limit(3),

      // Pacientes en riesgo — usa retention_score si ya fue calculado, sino fallback a last_visit_date
      sb.from('patients')
        .select('id, full_name, last_visit_date, retention_score')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .neq('status', 'lead')
        .or(`retention_score.lt.40,and(retention_score.is.null,last_visit_date.lt.${sixtyDaysAgo})`)
        .order('retention_score', { ascending: true, nullsFirst: false })
        .limit(5),

      // Oportunidades de retratamiento
      fetchRevenueOpportunities(organizationId),

      // Recuperado este mes (número héroe — metrics_daily)
      sb.from('metrics_daily')
        .select('estimated_revenue_recovered')
        .eq('organization_id', organizationId)
        .gte('date', monthStart),
    ])

  const appointments = (aptRes.data ?? []) as AppointmentRow[]
  const confirmed    = appointments.filter((a) => a.status === 'confirmed').length
  const noShows      = appointments.filter((a) => a.status === 'no_show').length
  const pending      = appointments.filter((a) => a.status === 'scheduled').length

  const ingresosDia  = appointments
    .filter((a) => a.status === 'completed' && a.price != null)
    .reduce((s, a) => s + (a.price ?? 0), 0)

  const unreadConvs  = (convRes.data ?? []) as ConvPreview[]
  const totalUnread  = unreadConvs.reduce((s, c) => s + c.unread_count, 0)
  const urgentTasks  = (tasksRes.count ?? 0) as number
  const staleLeads   = (staleLeadsRes.count ?? 0) as number
  const repAlerts    = (repRes.count ?? 0) as number
  const newLeads     = (newLeadsRes.count ?? 0) as number
  const reactivations  = (reactivationRes.data ?? []) as ReactivationRow[]
  const atRiskPatients = (atRiskRes.data ?? []) as AtRiskPatient[]
  const oppCount       = opportunities.length
  const recoveredMonth = ((recoveredRes.data ?? []) as { estimated_revenue_recovered: number | string }[])
    .reduce((s, r) => s + Number(r.estimated_revenue_recovered ?? 0), 0)
  const hasAlerts      = urgentTasks > 0 || staleLeads > 0 || repAlerts > 0 || atRiskPatients.length > 0 || oppCount > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Resumen operacional</h1>
        <p className="text-sm text-slate mt-1">{formatDate(today)}</p>
      </div>

      <OnboardingChecklist progress={onboarding} />

      {/* Número héroe — dinero recuperado por el agente este mes */}
      {recoveredMonth > 0 && (
        <Link
          href="/backfill"
          className="block bg-white rounded-2xl border border-fog shadow-xs px-6 py-5 hover:bg-mist transition-colors"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                Recuperado por PacienteIA este mes
              </p>
              <p className="text-3xl font-extrabold text-lima-600 mt-1">
                S/ {recoveredMonth.toLocaleString('es-PE')}
              </p>
              <p className="text-xs text-slate mt-1">
                Cupos de cancelaciones y ausencias que se volvieron a llenar
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-[#7C3AED] bg-[#F3EEFF] px-2.5 py-1 rounded-full">
              IA activa
            </span>
          </div>
        </Link>
      )}

      {/* Fila 1 — KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Citas hoy"
          value={appointments.length}
          sub={`${confirmed} confirmadas · ${pending} pendientes${noShows > 0 ? ` · ${noShows} inasist.` : ''}`}
          color="text-brand-600"
          subColor={noShows > 0 ? 'text-red-500' : undefined}
        />
        <KpiCard
          label="Ingresos del día"
          value={`S/ ${ingresosDia.toLocaleString('es-PE')}`}
          sub="Citas atendidas con precio"
          color={ingresosDia > 0 ? 'text-lima-600' : 'text-slate'}
        />
        <KpiCard
          label="Mensajes sin leer"
          value={totalUnread}
          sub={`${unreadConvs.length} conversación${unreadConvs.length !== 1 ? 'es' : ''}`}
          color={totalUnread > 0 ? 'text-amber-600' : 'text-slate'}
          href="/inbox"
        />
        <KpiCard
          label="Leads nuevos hoy"
          value={newLeads}
          sub="Sin gestionar"
          color={newLeads > 0 ? 'text-brand-600' : 'text-slate'}
          href="/inbox"
        />
      </div>

      {/* Fila 2 — Alertas operacionales */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-3">
          {staleLeads > 0 && (
            <Link
              href="/inbox"
              className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full">
                {staleLeads}
              </span>
              Lead{staleLeads > 1 ? 's' : ''} sin contactar &gt;2h
            </Link>
          )}
          {repAlerts > 0 && (
            <Link
              href="/analytics/reputation"
              className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-amber-100 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full">
                {repAlerts}
              </span>
              Alerta{repAlerts > 1 ? 's' : ''} de reputación
            </Link>
          )}
          {urgentTasks > 0 && (
            <Link
              href="/copilot"
              className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-orange-100 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full">
                {urgentTasks}
              </span>
              Tarea{urgentTasks > 1 ? 's' : ''} urgente{urgentTasks > 1 ? 's' : ''}
            </Link>
          )}
          {atRiskPatients.length > 0 && (
            <Link
              href="/patients"
              className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-amber-100 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-600 text-white text-xs font-bold rounded-full">
                {atRiskPatients.length}
              </span>
              Paciente{atRiskPatients.length > 1 ? 's' : ''} en riesgo de fuga
            </Link>
          )}
          {oppCount > 0 && (
            <Link
              href="/opportunities"
              className="flex items-center gap-2.5 bg-lima-50 border border-lima-200 text-lima-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-lima-100 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 bg-green-600 text-white text-xs font-bold rounded-full">
                {oppCount}
              </span>
              Oportunidad{oppCount !== 1 ? 'es' : ''} de agenda esta semana
            </Link>
          )}
        </div>
      )}

      {/* Filas 3 y 4 — Agenda + Actividad reciente */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Fila 3 — Agenda del día */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-fog shadow-xs">
          <div className="px-6 py-4 border-b border-fog flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Agenda de hoy</h2>
            <Link
              href="/appointments/new"
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              + Nueva cita
            </Link>
          </div>
          {appointments.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate text-center">
              No hay citas programadas para hoy
            </p>
          ) : (
            <ul className="divide-y divide-fog">
              {appointments.map((apt) => (
                <li key={apt.id}>
                  <Link
                    href={`/appointments/${apt.id}`}
                    className="px-6 py-4 flex items-center justify-between hover:bg-mist transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {apt.patients?.full_name ?? '—'}
                      </p>
                      <p className="text-xs text-slate mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {apt.treatment_type}
                        {apt.professionals && (
                          <>
                            <span className="text-fog">·</span>
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: apt.professionals.color }}
                            />
                            <span>{apt.professionals.name}</span>
                          </>
                        )}
                        {apt.price != null && (
                          <>
                            <span className="text-fog">·</span>
                            <span className="text-lima-600 font-medium">
                              S/ {apt.price.toLocaleString('es-PE')}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate">
                        {new Date(apt.scheduled_at).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <StatusBadge status={apt.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Columna derecha — Actividad reciente */}
        <div className="flex flex-col gap-4">
          {/* WhatsApp sin leer */}
          <div className="bg-white rounded-2xl border border-fog shadow-xs">
            <div className="px-5 py-3.5 border-b border-fog flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">WhatsApp sin leer</h2>
              <Link href="/inbox" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                Ver todo
              </Link>
            </div>
            {unreadConvs.length === 0 ? (
              <p className="px-5 py-5 text-xs text-slate text-center">Bandeja al día</p>
            ) : (
              <ul className="divide-y divide-fog">
                {unreadConvs.map((conv) => (
                  <li key={conv.id}>
                    <Link
                      href={`/inbox/conversations/${conv.id}`}
                      className="px-5 py-3 flex items-start gap-3 hover:bg-mist transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-ink truncate">
                            {conv.contact_name ?? conv.contact_phone}
                          </p>
                          {conv.last_message_at && (
                            <span className="text-xs text-slate shrink-0">
                              {relativeTime(conv.last_message_at)}
                            </span>
                          )}
                        </div>
                        {conv.last_message_preview && (
                          <p className="text-xs text-slate truncate mt-0.5">
                            {conv.last_message_preview}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 bg-brand-500 text-white text-xs font-bold rounded-full">
                        {conv.unread_count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fila 4 — Reactivaciones respondidas */}
          <div className="bg-white rounded-2xl border border-fog shadow-xs">
            <div className="px-5 py-3.5 border-b border-fog flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Reactivaciones</h2>
              <Link
                href="/analytics/reactivation"
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Ver todo
              </Link>
            </div>
            {reactivations.length === 0 ? (
              <p className="px-5 py-5 text-xs text-slate text-center">
                Sin respuestas recientes
              </p>
            ) : (
              <ul className="divide-y divide-fog">
                {reactivations.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink truncate">
                        {r.patients?.full_name ?? r.patients?.phone ?? '—'}
                      </p>
                      <span className="text-xs text-slate shrink-0">
                        {relativeTime(r.updated_at)}
                      </span>
                    </div>
                    <p className="text-xs text-lima-600 mt-0.5">Respondió sí ✓</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fila 5 — Pacientes en riesgo de abandono */}
          {atRiskPatients.length > 0 && (
            <div className="bg-white rounded-2xl border border-fog shadow-xs">
              <div className="px-5 py-3.5 border-b border-fog flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">En riesgo de abandono</h2>
                <Link href="/patients" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  Ver todos
                </Link>
              </div>
              <ul className="divide-y divide-fog">
                {atRiskPatients.map((p) => {
                  const days = p.last_visit_date
                    ? Math.floor((Date.now() - new Date(p.last_visit_date).getTime()) / 86_400_000)
                    : null
                  const scoreCls = p.retention_score !== null
                    ? p.retention_score < 20 ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                    : 'bg-[#F3F4F6] text-slate'
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/patients/${p.id}`}
                        className="px-5 py-3 flex items-center justify-between hover:bg-mist transition-colors"
                      >
                        <p className="text-sm font-medium text-ink truncate">{p.full_name}</p>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {p.retention_score !== null ? (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${scoreCls}`}>
                              {p.retention_score}
                            </span>
                          ) : null}
                          <span className="text-xs text-red-500">
                            {days !== null ? `${days}d sin visita` : 'Sin citas'}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Fila 6 — Oportunidades de agenda */}
          {oppCount > 0 && (
            <div className="bg-white rounded-2xl border border-fog shadow-xs">
              <div className="px-5 py-3.5 border-b border-fog flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Oportunidades de agenda</h2>
                <Link href="/opportunities" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  Ver todas
                </Link>
              </div>
              <ul className="divide-y divide-fog">
                {opportunities.slice(0, 4).map((opp) => (
                  <li key={`${opp.patientId}:${opp.treatmentType}`}>
                    <Link
                      href={`/appointments/new?patient_id=${opp.patientId}&treatment_type=${encodeURIComponent(opp.treatmentType)}`}
                      className="px-5 py-3 flex items-center justify-between hover:bg-mist transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{opp.patientName}</p>
                        <p className="text-xs text-slate truncate">{opp.treatmentType}</p>
                      </div>
                      <span className={`text-xs shrink-0 ml-2 font-medium ${
                        opp.urgency === 'overdue'   ? 'text-red-500' :
                        opp.urgency === 'this_week' ? 'text-amber-600' :
                        'text-lima-600'
                      }`}>
                        {opp.daysUntilDue < 0
                          ? `Venció hace ${Math.abs(opp.daysUntilDue)}d`
                          : opp.daysUntilDue === 0 ? 'Hoy'
                          : `En ${opp.daysUntilDue}d`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  color,
  subColor,
  href,
}: {
  label: string
  value: number | string
  sub: string
  color: string
  subColor?: string
  href?: string
}) {
  const inner = (
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-5 h-full">
      <p className="text-sm text-slate">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      <p className={`text-xs mt-1.5 ${subColor ?? 'text-slate'}`}>{sub}</p>
    </div>
  )
  if (href)
    return (
      <Link href={href} className="block hover:shadow-md transition-shadow rounded-2xl">
        {inner}
      </Link>
    )
  return inner
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Programada',   className: 'bg-[#F3F4F6] text-slate' },
    confirmed: { label: 'Confirmada',   className: 'bg-[#EBF5EB] text-[#16a34a]' },
    completed: { label: 'Atendida',     className: 'bg-brand-50 text-brand-700' },
    cancelled: { label: 'Cancelada',    className: 'bg-red-50 text-red-600' },
    no_show:   { label: 'Inasistencia', className: 'bg-[#FFF1EE] text-[#C2410C]' },
  }
  const { label, className } = map[status] ?? { label: status, className: 'bg-[#F3F6F9] text-slate' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${className}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
