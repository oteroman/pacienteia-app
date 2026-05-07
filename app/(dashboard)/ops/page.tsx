import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchOpsStats, fetchEscalations, fetchFollowUpsDue, fetchRecentEvents } from '@/lib/ops/stats'
import { AUTOMATION_RULES } from '@/lib/ops/automation'
import { CHANNEL_LABELS, CHANNEL_COLORS } from '@/lib/intake/index'
import { fetchAllClinicsPerformance } from '@/lib/analytics/revenue'

export default async function OpsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const [stats, escalations, followUps, events, allClinics] = await Promise.all([
    fetchOpsStats(clinicId),
    fetchEscalations(clinicId),
    fetchFollowUpsDue(clinicId),
    fetchRecentEvents(clinicId, 20),
    fetchAllClinicsPerformance('30d'),
  ])

  const criticalCount = escalations.length + followUps.length

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vista cross-sistema: intake → inbox → copiloto → resolución
          </p>
        </div>
        {criticalCount > 0 && (
          <span className="text-sm font-bold bg-red-600 text-white px-3 py-1.5 rounded-full">
            {criticalCount} requieren atención
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Nuevos" value={stats.intakesNew}
          color={stats.intakesNew > 10 ? 'text-red-600' : 'text-gray-900'} />
        <StatCard label="En proceso" value={stats.intakesInProgress} />
        <StatCard label="Esperando" value={stats.intakesWaiting}
          color={stats.intakesWaiting > 5 ? 'text-amber-600' : 'text-gray-900'} />
        <StatCard label="Tareas abiertas" value={stats.tasksOpen}
          color={stats.tasksOpen > 20 ? 'text-amber-600' : 'text-gray-900'} />
        <StatCard label="Escalaciones" value={stats.escalationsActive}
          color={stats.escalationsActive > 0 ? 'text-red-600' : 'text-green-600'} />
        <StatCard label="Follow-ups vencidos" value={stats.followUpsDue}
          color={stats.followUpsDue > 0 ? 'text-amber-600' : 'text-green-600'} />
        <StatCard label="Recibidos hoy" value={stats.intakesToday} />
        <StatCard label="Resueltos hoy" value={stats.resolvedToday}
          color={stats.resolvedToday > 0 ? 'text-green-600' : 'text-gray-400'} />
      </div>

      {/* Attention required */}
      {(escalations.length > 0 || followUps.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
            Requieren atención ahora
          </h2>

          {escalations.map((e) => (
            <Link key={e.id} href={`/inbox/${e.id}`}
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 hover:bg-red-50 transition-colors"
            >
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white flex-shrink-0">
                ESC {e.escalationLevel}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${CHANNEL_COLORS[e.sourceChannel]}`}>
                    {CHANNEL_LABELS[e.sourceChannel]}
                  </span>
                  {e.contactName && <span className="text-xs font-semibold text-gray-700">{e.contactName}</span>}
                </div>
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">
                  {e.normalizedSummary ?? 'Sin resumen'}
                </p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(e.createdAt)}</span>
            </Link>
          ))}

          {followUps.map((f) => (
            <Link key={f.id} href={`/inbox/${f.id}`}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 hover:bg-amber-50 transition-colors"
            >
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white flex-shrink-0">
                FOLLOW-UP
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${CHANNEL_COLORS[f.sourceChannel]}`}>
                    {CHANNEL_LABELS[f.sourceChannel]}
                  </span>
                  {f.contactName && <span className="text-xs font-semibold text-gray-700">{f.contactName}</span>}
                </div>
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">
                  {f.normalizedSummary ?? 'Sin resumen'}
                </p>
              </div>
              <span className="text-xs text-amber-600 flex-shrink-0">Vencido {timeAgo(f.followUpDueAt)}</span>
            </Link>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Automation rules */}
        <section className="rounded-2xl border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Reglas de automatización activas</h2>
          <div className="space-y-2">
            {AUTOMATION_RULES.filter((r) => r.implemented).map((rule) => (
              <div key={rule.id} className="flex items-start gap-3">
                <div className="flex flex-col gap-0.5 flex-shrink-0 pt-0.5">
                  <EngineBadge engine={rule.engine} />
                  <WhenBadge when={rule.when} schedule={rule.cronSchedule} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700">{rule.trigger}</p>
                  <p className="text-[11px] text-gray-500">{rule.action}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent audit events */}
        <section className="rounded-2xl border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Log de eventos recientes</h2>
          {events.length === 0 ? (
            <p className="text-xs text-gray-400">Sin eventos registrados aún.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <EventTypeBadge type={ev.eventType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600">
                      {EVENT_LABEL[ev.eventType] ?? ev.eventType}
                      {ev.details?.intent ? ` · ${ev.details.intent}` : ''}
                      {ev.details?.taskTitle ? ` · "${ev.details.taskTitle}"` : ''}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {ev.actor === 'system' ? 'Automático' : 'Staff'} · {timeAgo(ev.createdAt)}
                    </p>
                  </div>
                  <Link href={`/inbox/${ev.intakeId}`} className="text-[10px] text-brand-500 hover:underline flex-shrink-0">
                    ver →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* All-clinics performance table */}
      {allClinics.length > 0 && (
        <section className="rounded-2xl border bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Rendimiento por clínica (30 días)</h2>
            <Link href="/analytics/revenue" className="text-[11px] text-brand-600 hover:underline">
              ver detalle →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-100">
                  <th className="pb-2 font-medium">Clínica</th>
                  <th className="pb-2 font-medium text-right">Completadas</th>
                  <th className="pb-2 font-medium text-right">Fill rate</th>
                  <th className="pb-2 font-medium text-right">SLA</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allClinics.map((c) => (
                  <tr key={c.clinicId} className="hover:bg-gray-50/50">
                    <td className="py-2 font-medium text-gray-700 max-w-[160px] truncate">{c.clinicName}</td>
                    <td className="py-2 text-right tabular-nums text-gray-600">{c.completed}</td>
                    <td className="py-2 text-right tabular-nums">
                      <span className={c.fillRate >= 50 ? 'text-green-600' : c.fillRate >= 25 ? 'text-amber-600' : 'text-red-500'}>
                        {c.fillRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span className={c.slaMetRate >= 70 ? 'text-green-600' : c.slaMetRate >= 40 ? 'text-amber-600' : 'text-red-500'}>
                        {c.slaMetRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-600">
                      {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(c.revenueActual)}
                    </td>
                    <td className="py-2 text-right">
                      <ScoreBadge score={c.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-100 text-green-700'
    : score >= 40 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-600'
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>
}

// ── Sub-components ────────────────────────────────────────────
function StatCard({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-3xl font-bold tabular-nums mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function EngineBadge({ engine }: { engine: string }) {
  const color = engine === 'rules' ? 'bg-gray-100 text-gray-600'
    : engine === 'llm' ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700'
  const label = engine === 'rules' ? 'regla' : engine === 'llm' ? 'IA' : 'regla+IA'
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${color}`}>{label}</span>
}

function WhenBadge({ when, schedule }: { when: string; schedule?: string }) {
  const color = when === 'cron' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-700'
  const label = when === 'cron' ? (schedule ?? 'cron') : 'evento'
  return <span className={`text-[9px] px-1.5 py-0.5 rounded ${color}`}>{label}</span>
}

const EVENT_COLORS: Record<string, string> = {
  created:            'bg-blue-100 text-blue-700',
  normalized:         'bg-purple-100 text-purple-700',
  assigned:           'bg-brand-100 text-brand-700',
  status_changed:     'bg-gray-100 text-gray-600',
  escalated:          'bg-red-100 text-red-700',
  followup_triggered: 'bg-amber-100 text-amber-700',
  task_created:       'bg-indigo-100 text-indigo-700',
  resolved:           'bg-green-100 text-green-700',
  dismissed:          'bg-gray-100 text-gray-500',
}

const EVENT_LABEL: Record<string, string> = {
  created:            'Intake creado',
  normalized:         'Normalizado por IA',
  assigned:           'Asignado a staff',
  status_changed:     'Estado actualizado',
  escalated:          'Escalado por SLA',
  followup_triggered: 'Follow-up vencido',
  task_created:       'Tarea creada',
  resolved:           'Resuelto',
  dismissed:          'Ignorado',
}

function EventTypeBadge({ type }: { type: string }) {
  const cls = EVENT_COLORS[type] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${cls}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}
