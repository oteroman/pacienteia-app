import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { resolveTask, dismissTask } from '@/app/actions/copilot'
import type { CopilotTaskPriority } from '@/lib/copilot/index'

const PRIORITY_LABEL: Record<CopilotTaskPriority, string> = {
  high:   'Alta prioridad',
  medium: 'Prioridad media',
  low:    'Baja prioridad',
}
const PRIORITY_COLOR: Record<CopilotTaskPriority, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: task } = await sb
    .from('copilot_tasks')
    .select('*, patients(full_name)')
    .eq('id', id)
    .eq('organization_id', clinicId)
    .single()

  if (!task) notFound()

  const resolveWithId = resolveTask.bind(null, task.id)
  const dismissWithId = dismissTask.bind(null, task.id)

  const createdAt = new Date(task.created_at).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const isDone      = task.status === 'done'
  const isDismissed = task.status === 'dismissed'

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Back */}
      <Link href="/copilot" className="text-sm text-gray-400 hover:text-gray-600">
        ← Volver al Copiloto
      </Link>

      <div className="rounded-2xl border bg-white p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PRIORITY_COLOR[task.priority as CopilotTaskPriority]}`}>
                {PRIORITY_LABEL[task.priority as CopilotTaskPriority]}
              </span>
              {isDone && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                  Completada
                </span>
              )}
              {isDismissed && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                  Ignorada
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Detalle</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          {task.patients?.full_name && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Paciente</p>
              <p className="text-sm text-gray-700">{task.patients.full_name}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Creada</p>
            <p className="text-sm text-gray-700">{createdAt}</p>
          </div>
        </div>

        {/* Actions */}
        {!isDone && !isDismissed && (
          <div className="flex gap-3 pt-2 border-t">
            <form action={resolveWithId} className="flex-1">
              <button
                type="submit"
                className="w-full bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Marcar como lista
              </button>
            </form>
            <form action={dismissWithId}>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Ignorar
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
