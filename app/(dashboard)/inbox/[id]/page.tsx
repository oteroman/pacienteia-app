import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchIntake } from '@/lib/intake/index'
import {
  CHANNEL_LABELS, CHANNEL_COLORS,
  INTENT_LABELS,  INTENT_COLORS,
  STATUS_LABEL,   STATUS_COLOR,
  PRIORITY_COLOR,
} from '@/lib/intake/index'
import { getSlaStatus } from '@/lib/intake/orchestrate'
import { ResponseTemplates } from '@/components/intake/response-templates'
import { fetchClinicProfile, toDTO } from '@/lib/clinic/profile'
import {
  resolveIntake, dismissIntake,
  setWaitingCustomer, setWaitingStaff, assignToMe,
} from '@/app/actions/intake'

export default async function IntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const [intake, clinicProfile] = await Promise.all([
    fetchIntake(clinicId, id),
    fetchClinicProfile(clinicId),
  ])
  if (!intake) notFound()

  const profileDTO   = clinicProfile ? toDTO(clinicProfile) : null
  const sla          = getSlaStatus(intake.slaDueAt)
  const isAssignedMe = intake.assignedTo === user.id
  const isActive     = !['resolved', 'dismissed'].includes(intake.status)

  const resolveAction   = resolveIntake.bind(null, intake.id)
  const dismissAction   = dismissIntake.bind(null, intake.id)
  const waitCustAction  = setWaitingCustomer.bind(null, intake.id)
  const waitStaffAction = setWaitingStaff.bind(null, intake.id)
  const assignAction    = assignToMe.bind(null, intake.id)

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      <Link href="/inbox" className="text-sm text-gray-400 hover:text-gray-600">
        ← Bandeja unificada
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border bg-white p-6 space-y-4">

        {/* Badges row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            {intake.escalationLevel > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
                Escalado nivel {intake.escalationLevel}
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[intake.sourceChannel]}`}>
              {CHANNEL_LABELS[intake.sourceChannel]}
            </span>
            {intake.detectedIntent && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${INTENT_COLORS[intake.detectedIntent]}`}>
                {INTENT_LABELS[intake.detectedIntent]}
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[intake.priority]}`}>
              {intake.priority === 'high' ? 'Alta' : intake.priority === 'medium' ? 'Media' : 'Baja'}
            </span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 ${STATUS_COLOR[intake.status]}`}>
            {STATUS_LABEL[intake.status]}
          </span>
        </div>

        {/* SLA + orchestration metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaCell label="SLA">
            {sla ? (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sla.color}`}>
                {sla.overdue ? '⚠ ' : ''}{sla.label}
              </span>
            ) : <span className="text-xs text-gray-400">—</span>}
          </MetaCell>
          <MetaCell label="Interacciones">
            <span className="text-sm font-bold text-gray-800">{intake.interactionCount}</span>
          </MetaCell>
          <MetaCell label="Primera resp.">
            <span className="text-xs text-gray-600">
              {intake.firstResponseAt
                ? formatDateShort(intake.firstResponseAt)
                : <span className="text-amber-600">Pendiente</span>}
            </span>
          </MetaCell>
          <MetaCell label="Asignado">
            <span className="text-xs text-gray-600">
              {isAssignedMe ? 'Yo' : intake.assignedTo ? 'Otro' : <span className="text-gray-400">Sin asignar</span>}
            </span>
          </MetaCell>
        </div>

        {intake.followUpDueAt && intake.status === 'waiting_customer' && (
          <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2">
            Follow-up automático si no responde antes de {formatDateShort(intake.followUpDueAt)}
          </p>
        )}

        {/* Contact info */}
        {(intake.contactName || intake.contactPhone || intake.contactEmail) && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-0.5">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Contacto</p>
            {intake.contactName  && <p className="text-sm font-semibold text-gray-800">{intake.contactName}</p>}
            {intake.contactPhone && <p className="text-sm text-gray-600">{intake.contactPhone}</p>}
            {intake.contactEmail && <p className="text-sm text-gray-600">{intake.contactEmail}</p>}
          </div>
        )}

        {/* Summary */}
        {intake.normalizedSummary && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Resumen IA</p>
            <p className="text-sm text-gray-700">{intake.normalizedSummary}</p>
          </div>
        )}

        {/* Raw content */}
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Mensaje original</p>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-3 font-sans">
            {intake.rawContent}
          </pre>
        </div>

        {intake.tasksCreated > 0 && (
          <p className="text-xs text-blue-600">
            {intake.tasksCreated} tarea{intake.tasksCreated > 1 ? 's' : ''} generada{intake.tasksCreated > 1 ? 's' : ''} en Copiloto
          </p>
        )}
      </div>

      {/* Response templates (client component) */}
      {intake.detectedIntent && (
        <div className="rounded-2xl border bg-white p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Sugerencias de respuesta</p>
          <ResponseTemplates
            intakeId={intake.id}
            intent={intake.detectedIntent}
            channel={intake.sourceChannel}
            contactName={intake.contactName}
            profile={profileDTO}
          />
        </div>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="flex flex-wrap gap-2">
          {!intake.assignedTo && (
            <form action={assignAction}>
              <button type="submit" className="bg-brand-50 text-brand-700 hover:bg-brand-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Asignarme
              </button>
            </form>
          )}
          {(intake.status === 'new' || intake.status === 'in_progress') && (
            <form action={waitCustAction}>
              <button type="submit" className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                Esperando cliente
              </button>
            </form>
          )}
          {intake.status === 'waiting_customer' && (
            <form action={waitStaffAction}>
              <button type="submit" className="bg-orange-50 text-orange-700 hover:bg-orange-100 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                Cliente respondió
              </button>
            </form>
          )}
          <form action={resolveAction} className="ml-auto">
            <button type="submit" className="bg-green-600 text-white hover:bg-green-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Resolver
            </button>
          </form>
          <form action={dismissAction}>
            <button type="submit" className="bg-gray-100 text-gray-600 hover:bg-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Ignorar
            </button>
          </form>
        </div>
      )}

    </div>
  )
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  )
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
