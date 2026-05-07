import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchAllClinicHealth } from '@/lib/customer-health'
import { syncClinicTasks, fetchOpenTasks, fetchRecentlyResolved, PLAYBOOKS } from '@/lib/customer-health/tasks'
import { resolveTask, snoozeTask, addNote, triggerAutomation } from '@/app/actions/tasks'
import type { ClinicTask } from '@/lib/customer-health/tasks'
import type { AlertType } from '@/lib/customer-health'

// ── Access guard ─────────────────────────────────────────────
export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; filter?: string }>
}) {
  const params = await searchParams
  const secret = process.env.ADMIN_DASHBOARD_SECRET
  if (!secret || params.key !== secret) notFound()

  const health = await fetchAllClinicHealth()
  await syncClinicTasks(health)

  const [openTasks, recentlyResolved] = await Promise.all([
    fetchOpenTasks(),
    fetchRecentlyResolved(),
  ])

  const key    = params.key!
  const filter = params.filter ?? 'all'

  // Aging + escalation derived state
  const now = Date.now()
  const aged      = openTasks.filter((t) => ageHours(t.createdAt) >= 24)
  const escalated = openTasks.filter((t) => t.escalatedAt !== null)
  const reminded  = openTasks.filter((t) => t.reminderSentAt !== null)

  const visible = filter === 'aged'      ? aged
                : filter === 'escalated' ? escalated
                : openTasks

  const highPrio   = visible.filter((t) => t.priority === 'high')
  const mediumPrio = visible.filter((t) => t.priority === 'medium')

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playbook operativo</h1>
          <p className="text-sm text-gray-500 mt-1">
            {openTasks.length} abierta{openTasks.length !== 1 ? 's' : ''}
            {aged.length > 0 && <> · <span className="text-amber-600">{aged.length} envejecida{aged.length !== 1 ? 's' : ''}</span></>}
            {escalated.length > 0 && <> · <span className="text-red-600">{escalated.length} escalada{escalated.length !== 1 ? 's' : ''}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/analytics/health?key=${key}`}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            ← Health scores
          </Link>
          <span className="text-gray-200">·</span>
          <form action={triggerAutomation}>
            <button
              type="submit"
              className="text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              ↻ Sync ahora
            </button>
          </form>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {[
          { value: 'all',       label: `Todas (${openTasks.length})` },
          { value: 'aged',      label: `Envejecidas (${aged.length})` },
          { value: 'escalated', label: `Escaladas (${escalated.length})` },
        ].map(({ value, label }) => (
          <Link
            key={value}
            href={`/analytics/playbook?key=${key}&filter=${value}`}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filter === value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Automation stats strip */}
      {reminded.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <span>⏰</span>
          <span>{reminded.length} tarea{reminded.length !== 1 ? 's' : ''} con recordatorio enviado · {escalated.length} escalada{escalated.length !== 1 ? 's' : ''} por antigüedad</span>
        </div>
      )}

      {/* Tasks — high priority */}
      {highPrio.length > 0 && (
        <TaskSection title="Urgentes" color="red">
          {highPrio.map((task) => (
            <TaskCard key={task.id} task={task} queryKey={key} />
          ))}
        </TaskSection>
      )}

      {/* Tasks — medium priority */}
      {mediumPrio.length > 0 && (
        <TaskSection title="Seguimiento" color="amber">
          {mediumPrio.map((task) => (
            <TaskCard key={task.id} task={task} queryKey={key} />
          ))}
        </TaskSection>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">✅</p>
          <p className="text-sm text-gray-500">
            {filter === 'all' ? 'Sin tareas abiertas.' : `Sin tareas en esta vista.`}
          </p>
        </div>
      )}

      {/* Recently resolved */}
      {recentlyResolved.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500">Últimas resueltas / pospuestas</h2>
          <ul className="divide-y divide-gray-50">
            {recentlyResolved.map((task) => (
              <li key={task.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={task.status} />
                  <span className="text-gray-600 truncate">{task.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">{task.clinicName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.status === 'snoozed' && task.snoozedUntil && (
                    <span className="text-xs text-amber-600">hasta {fmtDate(task.snoozedUntil)}</span>
                  )}
                  <ResolvedBadge status={task.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Playbook reference */}
      <PlaybookReference />
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────
function TaskCard({ task, queryKey }: { task: ClinicTask; queryKey: string }) {
  const sla     = PLAYBOOKS[task.triggerType]?.sla ?? '—'
  const hours   = ageHours(task.createdAt)
  const isAged  = hours >= 24
  const isOld   = hours >= 72

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      task.escalatedAt ? 'border-red-200' : isAged ? 'border-amber-200' : 'border-gray-100'
    }`}>

      {/* Top */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityDot priority={task.priority} />
            <span className="font-semibold text-gray-900 text-sm">{task.title}</span>
            <AlertChip trigger={task.triggerType} />
            <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">SLA {sla}</span>
            {task.escalatedAt && (
              <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-medium">↑ auto-escalada</span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            <Link
              href={`/analytics/health?key=${queryKey}`}
              className="font-medium text-gray-700 hover:underline"
            >
              {task.clinicName}
            </Link>
            {' '}· <PlanText plan={task.plan} />
            {task.healthScore !== null && (
              <> · score <span className={scoreColor(task.healthScore)}>{task.healthScore}</span></>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <AgeBadge hours={hours} />
          {task.reminderSentAt && (
            <p className="text-xs text-amber-600 mt-0.5">⏰ recordatorio</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pb-4 space-y-3">
        <p className="text-sm text-gray-600">{task.description}</p>
        <div className="flex items-start gap-2">
          <span className="text-brand-600 font-semibold text-sm mt-0.5 shrink-0">→</span>
          <p className="text-sm text-gray-800 font-medium">{task.actionText}</p>
        </div>

        {task.lastNote && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800">
            <span className="font-medium">Nota: </span>{task.lastNote}
          </div>
        )}

        {task.messageTemplate && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none list-none flex items-center gap-1">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              Plantilla de mensaje
            </summary>
            <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-600 leading-relaxed select-all whitespace-pre-wrap font-mono">
              {task.messageTemplate}
            </div>
          </details>
        )}

        {/* Note input */}
        <form action={addNote.bind(null, task.id)} className="flex gap-2 pt-1">
          <input
            name="note"
            type="text"
            placeholder="Añadir nota de seguimiento…"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
            maxLength={300}
          />
          <button
            type="submit"
            className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            Guardar
          </button>
        </form>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 bg-gray-50/50">
        <form action={resolveTask.bind(null, task.id)}>
          <button type="submit" className="text-sm font-medium text-green-700 hover:text-green-800 transition-colors">
            ✓ Marcar hecho
          </button>
        </form>
        <span className="text-gray-200">·</span>
        <form action={snoozeTask.bind(null, task.id, 3)}>
          <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Posponer 3d
          </button>
        </form>
        <span className="text-gray-200">·</span>
        <form action={snoozeTask.bind(null, task.id, 7)}>
          <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Posponer 7d
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Playbook reference ────────────────────────────────────────
function PlaybookReference() {
  return (
    <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <summary className="px-6 py-4 cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-700 select-none list-none">
        📋 Referencia de playbooks y reglas de automatización
      </summary>
      <div className="px-6 pb-5 space-y-1 border-t border-gray-50 pt-4">
        <div className="grid grid-cols-2 gap-x-6 text-xs text-gray-500 mb-4">
          <div>⏰ Reminder logged: &gt;24h abierta (una vez)</div>
          <div>🔺 Escala a high: &gt;72h en medium (una vez)</div>
          <div>♻️ Reabre snooze: cuando vence snoozed_until</div>
          <div>🔄 Sync: al cargar o con "↻ Sync ahora"</div>
        </div>
        {(Object.entries(PLAYBOOKS) as [AlertType, typeof PLAYBOOKS[AlertType]][]).map(([key, pb]) => (
          <div key={key} className="pt-3 space-y-0.5 border-t border-gray-50 first:border-0 first:pt-0">
            <div className="flex items-center gap-2">
              <AlertChip trigger={key} />
              <span className="text-sm font-semibold text-gray-800">{pb.title}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                pb.priority === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}>{pb.priority} · {pb.sla}</span>
            </div>
            <p className="text-xs text-gray-500 pl-1">{pb.description}</p>
            <p className="text-xs text-gray-700 pl-1">→ {pb.action}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function ageHours(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

// ── Small UI components ───────────────────────────────────────
function TaskSection({ title, color, children }: {
  title: string; color: 'red' | 'amber'; children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <h2 className={`text-sm font-semibold ${color === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{title}</h2>
      {children}
    </div>
  )
}

function AgeBadge({ hours }: { hours: number }) {
  if (hours < 24)  return <span className="text-xs text-gray-300">{hours}h</span>
  const days = Math.floor(hours / 24)
  const cls  = hours >= 72 ? 'text-red-600 font-medium' : 'text-amber-600'
  return <span className={`text-xs ${cls}`}>{days}d{hours >= 72 ? ' ⚠️' : ''}</span>
}

function PriorityDot({ priority }: { priority: string }) {
  const cls = priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-amber-400' : 'bg-gray-300'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls} shrink-0`} />
}

function AlertChip({ trigger }: { trigger: AlertType }) {
  const map: Record<AlertType, { label: string; cls: string }> = {
    at_risk:       { label: 'at_risk',       cls: 'bg-red-50 text-red-600' },
    churned:       { label: 'churned',       cls: 'bg-gray-100 text-gray-500' },
    upgrade_ready: { label: 'upgrade_ready', cls: 'bg-green-50 text-green-700' },
    high_friction: { label: 'high_friction', cls: 'bg-orange-50 text-orange-700' },
    declining:     { label: 'declining',     cls: 'bg-red-50 text-red-600' },
    inactive:      { label: 'inactive',      cls: 'bg-gray-100 text-gray-500' },
  }
  const { label, cls } = map[trigger]
  return <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${cls}`}>{label}</span>
}

function PlanText({ plan }: { plan: string }) {
  const cls = plan === 'premium' ? 'text-purple-600' : plan === 'pro' ? 'text-blue-600' : 'text-gray-500'
  return <span className={`capitalize ${cls}`}>{plan}</span>
}

function StatusDot({ status }: { status: string }) {
  const cls = status === 'done' ? 'bg-green-400' : 'bg-amber-400'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls} shrink-0`} />
}

function ResolvedBadge({ status }: { status: string }) {
  if (status === 'done')    return <span className="text-xs text-green-600 font-medium">hecho</span>
  if (status === 'snoozed') return <span className="text-xs text-amber-600 font-medium">pospuesto</span>
  return null
}

function scoreColor(score: number) {
  return score >= 70 ? 'text-green-600 font-medium' : score >= 45 ? 'text-amber-600 font-medium' : 'text-red-600 font-medium'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}
