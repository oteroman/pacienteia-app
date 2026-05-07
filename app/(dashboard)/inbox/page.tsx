import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchInbox, fetchRecentResolved } from '@/lib/intake/index'
import {
  CHANNEL_LABELS, CHANNEL_COLORS,
  INTENT_LABELS,  STATUS_LABEL, STATUS_COLOR,
} from '@/lib/intake/index'
import type { Intake, IntakePriority, IntakeStatus } from '@/lib/intake/index'
import { getSlaStatus } from '@/lib/intake/orchestrate'
import {
  resolveIntake, dismissIntake, markInProgress,
  setWaitingCustomer, setWaitingStaff, assignToMe,
} from '@/app/actions/intake'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const [active, resolved] = await Promise.all([
    fetchInbox(clinicId),
    fetchRecentResolved(clinicId),
  ])

  const urgentCount    = active.filter((i) => i.priority === 'high').length
  const escalatedCount = active.filter((i) => i.escalationLevel > 0).length
  const overdueCount   = active.filter((i) => {
    const s = getSlaStatus(i.slaDueAt)
    return s?.overdue ?? false
  }).length

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bandeja unificada</h1>
          <p className="text-sm text-gray-500 mt-1">
            WhatsApp · Formularios · Llamadas · Instagram · TikTok
          </p>
        </div>
        <Link
          href="/inbox/new"
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
        >
          + Registrar entrada
        </Link>
      </div>

      {/* Status strip */}
      {active.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {escalatedCount > 0 && (
            <span className="font-bold bg-red-600 text-white px-3 py-1.5 rounded-full">
              {escalatedCount} escalado{escalatedCount > 1 ? 's' : ''}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="font-semibold bg-red-100 text-red-700 px-3 py-1.5 rounded-full">
              {overdueCount} SLA vencido{overdueCount > 1 ? 's' : ''}
            </span>
          )}
          {urgentCount > 0 && (
            <span className="font-semibold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
              {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-gray-400 self-center">
            {active.length} pendiente{active.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Active intakes */}
      {active.length === 0 ? (
        <div className="rounded-2xl border bg-gray-50 p-12 text-center">
          <p className="text-sm text-gray-400">La bandeja está vacía.</p>
          <Link href="/inbox/new" className="text-sm text-brand-600 hover:underline mt-2 block">
            Registrar entrada manualmente →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((intake) => (
            <IntakeCard key={intake.id} intake={intake} currentUserId={user.id} />
          ))}
        </div>
      )}

      {/* Recently resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Resueltos recientemente
          </h2>
          <div className="space-y-1">
            {resolved.map((i) => (
              <ResolvedRow key={i.id} intake={i} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

// ── IntakeCard ────────────────────────────────────────────────
function IntakeCard({ intake, currentUserId }: { intake: Intake; currentUserId: string }) {
  const sla          = getSlaStatus(intake.slaDueAt)
  const isEscalated  = intake.escalationLevel > 0
  const isAssignedMe = intake.assignedTo === currentUserId
  const snippet      = intake.normalizedSummary ?? intake.rawContent.slice(0, 120)

  const resolveAction   = resolveIntake.bind(null, intake.id)
  const dismissAction   = dismissIntake.bind(null, intake.id)
  const inProgressAct   = markInProgress.bind(null, intake.id)
  const waitCustAction  = setWaitingCustomer.bind(null, intake.id)
  const waitStaffAction = setWaitingStaff.bind(null, intake.id)
  const assignAction    = assignToMe.bind(null, intake.id)

  return (
    <div className={`rounded-xl border bg-white p-4 space-y-2.5 transition-colors
      ${isEscalated ? 'border-red-400 bg-red-50/30' : intake.priority === 'high' ? 'border-red-200' : 'border-gray-100'}`}
    >
      {/* Row 1: badges + SLA + time */}
      <div className="flex items-center gap-2 flex-wrap">
        <PriorityDot priority={intake.priority} />

        {isEscalated && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
            ESC. {intake.escalationLevel}
          </span>
        )}

        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[intake.sourceChannel]}`}>
          {CHANNEL_LABELS[intake.sourceChannel]}
        </span>

        {intake.detectedIntent && (
          <span className="text-[10px] text-gray-500">
            {INTENT_LABELS[intake.detectedIntent]}
          </span>
        )}

        <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLOR[intake.status]}`}>
          {STATUS_LABEL[intake.status]}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {sla && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sla.color}`}>
              {sla.overdue ? '⚠ ' : ''}{sla.label}
            </span>
          )}
          <span className="text-[10px] text-gray-400">{formatTimeAgo(intake.createdAt)}</span>
        </div>
      </div>

      {/* Row 2: contact + snippet */}
      <div>
        {intake.contactName && (
          <p className="text-xs font-semibold text-gray-700">
            {intake.contactName}
            {intake.contactPhone && <span className="font-normal text-gray-400 ml-1">· {intake.contactPhone}</span>}
            {isAssignedMe && <span className="ml-2 text-[10px] text-brand-600 font-medium">Asignado a mí</span>}
            {intake.assignedTo && !isAssignedMe && <span className="ml-2 text-[10px] text-gray-400">Asignado</span>}
          </p>
        )}
        <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{snippet}</p>
      </div>

      {/* Row 3: actions */}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        <Link href={`/inbox/${intake.id}`} className="text-xs text-brand-600 hover:underline font-medium">
          Ver detalle →
        </Link>

        {!intake.assignedTo && (
          <form action={assignAction}>
            <button type="submit" className="text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors">
              Asignarme
            </button>
          </form>
        )}

        <div className="ml-auto flex gap-1.5 flex-wrap justify-end">
          {intake.status === 'new' && (
            <form action={inProgressAct}>
              <button type="submit" className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                Atender
              </button>
            </form>
          )}
          {(intake.status === 'new' || intake.status === 'in_progress') && (
            <form action={waitCustAction}>
              <button type="submit" className="text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                Esperando cliente
              </button>
            </form>
          )}
          {intake.status === 'waiting_customer' && (
            <form action={waitStaffAction}>
              <button type="submit" className="text-xs text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                Cliente respondió
              </button>
            </form>
          )}
          <form action={resolveAction}>
            <button type="submit" className="text-xs text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
              Resolver
            </button>
          </form>
          <form action={dismissAction}>
            <button type="submit" className="text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors">
              Ignorar
            </button>
          </form>
        </div>
      </div>

      {intake.tasksCreated > 0 && (
        <p className="text-[10px] text-blue-500">
          {intake.tasksCreated} tarea{intake.tasksCreated > 1 ? 's' : ''} creada{intake.tasksCreated > 1 ? 's' : ''} en copiloto
        </p>
      )}
    </div>
  )
}

// ── ResolvedRow ───────────────────────────────────────────────
function ResolvedRow({ intake }: { intake: Intake }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
      <span className={`text-[10px] px-2 py-0.5 rounded-full ${CHANNEL_COLORS[intake.sourceChannel]}`}>
        {CHANNEL_LABELS[intake.sourceChannel]}
      </span>
      <p className="text-xs text-gray-500 flex-1 line-clamp-1">
        {intake.normalizedSummary ?? intake.rawContent.slice(0, 80)}
      </p>
      <span className="text-[10px] text-gray-300">{formatTimeAgo(intake.updatedAt)}</span>
      <span className="text-[10px] text-gray-400">{STATUS_LABEL[intake.status]}</span>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function PriorityDot({ priority }: { priority: IntakePriority }) {
  const color = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-gray-300' }[priority]
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
}

function formatTimeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}
