import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchCopilotDashboard } from '@/lib/copilot/index'
import { SOURCE_LABELS, SOURCE_COLORS } from '@/lib/copilot/index'
import type { Interaction, CopilotTask, CopilotTaskPriority } from '@/lib/copilot/index'
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

export default async function CopilotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const { interactions, openTasks } = await fetchCopilotDashboard(clinicId)

  return (
    <div className="max-w-4xl mx-auto space-y-8">

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

      {/* Recent interactions */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Interacciones recientes
        </h2>

        {interactions.length === 0 ? (
          <div className="rounded-2xl border bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-400">Aún no hay interacciones registradas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {interactions.map((i) => (
              <InteractionCard key={i.id} interaction={i} />
            ))}
          </div>
        )}
      </section>

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
        <p className="text-sm font-semibold text-gray-800 mt-1">{task.title}</p>
        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
        )}
      </div>
      <div className="flex gap-2 flex-shrink-0">
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

function InteractionCard({ interaction: i }: { interaction: Interaction }) {
  const date = new Date(i.createdAt).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const statusColor =
    i.status === 'done'       ? 'text-green-600'  :
    i.status === 'failed'     ? 'text-red-500'     :
    i.status === 'processing' ? 'text-amber-500'   : 'text-gray-400'

  return (
    <div className="rounded-xl border bg-white p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[i.sourceType]}`}>
          {SOURCE_LABELS[i.sourceType]}
        </span>
        {i.patientName && (
          <span className="text-xs text-gray-500">{i.patientName}</span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">{date}</span>
        <span className={`text-[10px] font-semibold capitalize ${statusColor}`}>{i.status}</span>
      </div>

      {i.summary ? (
        <p className="text-sm text-gray-700">{i.summary}</p>
      ) : (
        <p className="text-sm text-gray-400 italic line-clamp-2">{i.rawContent}</p>
      )}

      {(i.commitments.length > 0 || i.risks.length > 0) && (
        <div className="flex gap-4 text-xs text-gray-500">
          {i.commitments.length > 0 && (
            <span>{i.commitments.length} compromiso{i.commitments.length > 1 ? 's' : ''}</span>
          )}
          {i.risks.length > 0 && (
            <span className="text-amber-600">{i.risks.length} riesgo{i.risks.length > 1 ? 's' : ''}</span>
          )}
          {i.tasksCreated > 0 && (
            <span className="text-blue-600">{i.tasksCreated} tarea{i.tasksCreated > 1 ? 's' : ''} generadas</span>
          )}
        </div>
      )}
    </div>
  )
}
