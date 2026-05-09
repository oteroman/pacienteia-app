import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchCopilotDashboard } from '@/lib/copilot/index'
import { SOURCE_LABELS, SOURCE_COLORS } from '@/lib/copilot/index'
import type { CopilotTask, CopilotTaskPriority } from '@/lib/copilot/index'
import { resolveTask, dismissTask } from '@/app/actions/copilot'

const PRIORITY_LABEL: Record<CopilotTaskPriority, string> = {
  high:   'Alta',
  medium: 'Media',
  low:    'Baja',
}

const PRIORITY_COLOR: Record<CopilotTaskPriority, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
}

export default async function CopilotPage({
  searchParams,
}: {
  searchParams: Promise<{ analizado?: string; tareas?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const { openTasks, doneTasks } = await fetchCopilotDashboard(clinicId)
  const params = await searchParams
  const tareasCount = params.tareas ? parseInt(params.tareas, 10) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Success banner */}
      {params.analizado === '1' && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          {tareasCount > 0
            ? `Interacción analizada. Se generaron ${tareasCount} tarea${tareasCount > 1 ? 's' : ''} nuevas.`
            : 'Interacción analizada. No se detectaron tareas pendientes.'}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Copiloto Operativo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registra notas de WhatsApp, llamadas o staff — el copiloto extrae tareas automáticamente
          </p>
        </div>
        <Link
          href="/copilot/new"
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
        >
          + Nueva interacción
        </Link>
      </div>

      {/* Open tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">
            Tareas abiertas
            {openTasks.length > 0 && (
              <span className="ml-2 text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {openTasks.length}
              </span>
            )}
          </h2>
        </div>

        {openTasks.length === 0 ? (
          <div className="rounded-2xl border bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-400">No hay tareas abiertas. Bien hecho.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>

      {/* Done tasks — collapsible */}
      {doneTasks.length > 0 && (
        <section>
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none mb-3">
              <span className="text-base font-semibold text-gray-800">Completadas e ignoradas</span>
              <span className="text-xs font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {doneTasks.length}
              </span>
              <span className="ml-auto text-xs text-gray-400 group-open:hidden">Ver historial ▾</span>
              <span className="ml-auto text-xs text-gray-400 hidden group-open:inline">Ocultar ▴</span>
            </summary>

            <div className="space-y-2">
              {doneTasks.map((task) => (
                <DoneTaskCard key={task.id} task={task} />
              ))}
            </div>
          </details>
        </section>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function TaskCard({ task }: { task: CopilotTask }) {
  const resolveWithId = resolveTask.bind(null, task.id)
  const dismissWithId = dismissTask.bind(null, task.id)

  return (
    <div className="rounded-xl border bg-white p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          {task.patientName && (
            <span className="text-xs text-gray-400">{task.patientName}</span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[task.sourceType]}`}>
            {SOURCE_LABELS[task.sourceType]}
          </span>
        </div>
        <Link href={`/copilot/tasks/${task.id}`} className="block group mt-1">
          <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-600 transition-colors">
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </Link>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Link
          href={`/copilot/tasks/${task.id}`}
          className="text-xs text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Ver
        </Link>
        <form action={resolveWithId}>
          <button
            type="submit"
            className="text-xs text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            Listo
          </button>
        </form>
        <form action={dismissWithId}>
          <button
            type="submit"
            className="text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            Ignorar
          </button>
        </form>
      </div>
    </div>
  )
}

function DoneTaskCard({ task }: { task: CopilotTask }) {
  const resolvedAt = task.resolvedAt
    ? new Date(task.resolvedAt).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="rounded-xl border bg-gray-50 p-4 flex items-start gap-4 opacity-75">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {task.status === 'done' ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              Lista
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
              Ignorada
            </span>
          )}
          {task.patientName && (
            <span className="text-xs text-gray-400">{task.patientName}</span>
          )}
          {resolvedAt && (
            <span className="ml-auto text-[10px] text-gray-400">{resolvedAt}</span>
          )}
        </div>
        <Link href={`/copilot/tasks/${task.id}`} className="block group mt-1">
          <p className="text-sm font-medium text-gray-500 line-through group-hover:no-underline group-hover:text-brand-600 transition-colors">
            {task.title}
          </p>
        </Link>
      </div>
      <Link
        href={`/copilot/tasks/${task.id}`}
        className="text-xs text-gray-400 bg-white hover:bg-gray-100 border px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0"
      >
        Ver
      </Link>
    </div>
  )
}
