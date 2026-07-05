import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import {
  markLeadInProgress, markLeadWaitingCustomer,
  markLeadResolved, archiveLead, addLeadNote,
  convertLeadToPatient, scheduleLeadAppointment,
} from '@/app/actions/leads'
import {
  CHANNEL_LABELS, CHANNEL_COLORS, STATUS_LABEL, STATUS_COLOR, PRIORITY_COLOR,
  type IntakeChannel, type IntakeStatus, type IntakePriority,
} from '@/lib/intake/index'

interface PageProps { params: Promise<{ id: string }> }

type IntakeEvent = {
  id:         string
  event_type: string
  actor:      string
  details:    Record<string, unknown>
  created_at: string
}

const EVENT_LABEL: Record<string, string> = {
  created:            'Lead creado',
  normalized:         'Clasificado por IA',
  assigned:           'Asignado',
  status_changed:     'Estado actualizado',
  escalated:          'Escalado',
  followup_triggered: 'Follow-up enviado',
  resolved:           'Resuelto',
  dismissed:          'Archivado',
  task_created:       'Tarea creada',
  note:               'Nota',
}

const EVENT_COLOR: Record<string, string> = {
  created:    'bg-blue-100 text-blue-700',
  normalized: 'bg-ai-100 text-ai-600',
  resolved:   'bg-lima-100 text-lima-700',
  dismissed:  'bg-[#F3F6F9] text-slate',
  escalated:  'bg-red-100 text-red-700',
  note:       'bg-amber-100 text-amber-700',
}

const PIPELINE_STEPS: { status: IntakeStatus; label: string }[] = [
  { status: 'new',              label: 'Nuevo'       },
  { status: 'in_progress',      label: 'En contacto' },
  { status: 'waiting_customer', label: 'Esperando'   },
  { status: 'resolved',         label: 'Resuelto'    },
]

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params
  const orgId  = await getActiveClinicId()
  if (!orgId) redirect('/org-selector')

  const sb = createAdminClient() as any

  const [intakeRes, eventsRes] = await Promise.all([
    sb.from('intakes')
      .select('*, patients(id, full_name, phone)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single(),
    sb.from('intake_events')
      .select('id, event_type, actor, details, created_at')
      .eq('intake_id', id)
      .order('created_at', { ascending: true }),
  ])

  const lead   = intakeRes.data
  if (!lead) notFound()

  const events: IntakeEvent[] = eventsRes.data ?? []

  const slaOverdue = lead.sla_due_at && new Date(lead.sla_due_at) < new Date()
  const currentStep = PIPELINE_STEPS.findIndex((s) => s.status === lead.status)
  const isArchived  = lead.status === 'dismissed'
  const isResolved  = lead.status === 'resolved'
  const isDone      = isArchived || isResolved

  async function handleArchive() {
    'use server'
    await archiveLead(id)
    redirect('/leads')
  }

  async function handleConvert() {
    'use server'
    await convertLeadToPatient(id)
    redirect(`/leads/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Link href="/leads" className="text-sm text-slate hover:text-slate transition-colors">
          ← Leads
        </Link>
        {!isDone && (
          <form action={handleArchive}>
            <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors px-3 py-1.5 border border-red-100 rounded-lg hover:bg-red-50">
              Archivar lead
            </button>
          </form>
        )}
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">
              {lead.contact_name ?? lead.contact_phone ?? 'Lead sin nombre'}
            </h1>
            {lead.contact_name && lead.contact_phone && (
              <p className="text-sm text-slate mt-0.5">{lead.contact_phone}</p>
            )}
            {lead.contact_email && (
              <p className="text-xs text-slate mt-0.5">{lead.contact_email}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[lead.status as IntakeStatus] ?? ''}`}>
              {STATUS_LABEL[lead.status as IntakeStatus] ?? lead.status}
            </span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${PRIORITY_COLOR[lead.priority as IntakePriority] ?? ''}`}>
              {lead.priority === 'high' ? 'Alta prioridad' : lead.priority === 'medium' ? 'Prioridad media' : 'Prioridad baja'}
            </span>
          </div>
        </div>

        {/* Channel + SLA */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${CHANNEL_COLORS[lead.source_channel as IntakeChannel] ?? 'bg-[#F3F6F9] text-slate'}`}>
            {CHANNEL_LABELS[lead.source_channel as IntakeChannel] ?? lead.source_channel}
          </span>
          {lead.sla_due_at && (
            <span className={`text-xs font-medium ${slaOverdue ? 'text-red-600' : 'text-slate'}`}>
              {slaOverdue
                ? `⚠ SLA vencido ${formatTimeAgo(lead.sla_due_at)}`
                : `SLA vence ${formatRelative(lead.sla_due_at)}`}
            </span>
          )}
          {lead.first_response_at && (
            <span className="text-xs text-slate">
              Primera respuesta: {formatTimeAgo(lead.first_response_at)}
            </span>
          )}
        </div>

        {/* Message */}
        <div className="bg-mist rounded-xl p-4">
          {lead.normalized_summary ? (
            <>
              <p className="text-sm font-medium text-slate mb-1">Resumen</p>
              <p className="text-sm text-slate">{lead.normalized_summary}</p>
              <details className="mt-2">
                <summary className="text-xs text-slate cursor-pointer hover:text-slate">Ver mensaje original</summary>
                <p className="text-xs text-slate mt-1 whitespace-pre-wrap">{lead.raw_content}</p>
              </details>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate mb-1">Mensaje</p>
              <p className="text-sm text-slate whitespace-pre-wrap">{lead.raw_content}</p>
            </>
          )}
        </div>

        {/* Linked patient */}
        {lead.patients ? (
          <div className="flex items-center justify-between p-3 bg-brand-50 rounded-xl border border-brand-100">
            <div>
              <p className="text-xs text-brand-600 font-medium">Paciente vinculado</p>
              <p className="text-sm font-semibold text-brand-800 mt-0.5">{lead.patients.full_name}</p>
            </div>
            <Link
              href={`/patients/${lead.patients.id}`}
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
            >
              Ver paciente →
            </Link>
          </div>
        ) : !isDone && (
          <form action={handleConvert}>
            <button type="submit" className="w-full text-sm font-medium text-brand-700 border border-brand-200 px-4 py-2.5 rounded-xl hover:bg-brand-50 transition-colors">
              + Crear paciente desde este lead
            </button>
          </form>
        )}
      </div>

      {/* Pipeline stepper */}
      {!isArchived && (
        <div className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Pipeline</h2>

          {/* Stepper */}
          <div className="flex items-center gap-0">
            {PIPELINE_STEPS.map((step, i) => {
              const done    = currentStep > i
              const active  = currentStep === i
              const future  = currentStep < i
              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      done   ? 'bg-brand-600 border-brand-600 text-white' :
                      active ? 'bg-white border-brand-600 text-brand-600' :
                               'bg-white border-fog text-slate'
                    }`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <p className={`text-[10px] mt-1 font-medium text-center ${active ? 'text-brand-700' : done ? 'text-brand-500' : 'text-slate'}`}>
                      {step.label}
                    </p>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 ${done ? 'bg-brand-400' : 'bg-fog'}`} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Action buttons based on current state */}
          {!isDone && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-fog">
              {lead.status === 'new' && (
                <form action={markLeadInProgress}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="text-sm font-semibold bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors">
                    Marcar en contacto
                  </button>
                </form>
              )}
              {(lead.status === 'in_progress' || lead.status === 'waiting_staff') && (
                <form action={markLeadWaitingCustomer}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="text-sm font-semibold bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors">
                    Esperando respuesta
                  </button>
                </form>
              )}
              {lead.status === 'waiting_customer' && (
                <form action={markLeadInProgress}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="text-sm font-semibold bg-amber-500 text-white px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors">
                    Retomar contacto
                  </button>
                </form>
              )}
              {lead.status !== 'new' && (
                <form action={markLeadResolved}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
                    Marcar resuelto
                  </button>
                </form>
              )}
              <form action={scheduleLeadAppointment.bind(null, id)}>
                <button type="submit" className="text-sm font-semibold border border-brand-200 text-brand-600 px-4 py-2 rounded-xl hover:bg-brand-50 transition-colors">
                  + Agendar cita
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Add note */}
      {!isDone && (
        <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
          <h2 className="text-sm font-semibold text-ink mb-3">Agregar nota</h2>
          <form action={addLeadNote} className="flex gap-2">
            <input type="hidden" name="id" value={id} />
            <input
              name="note"
              type="text"
              placeholder="Ej: Llamó para confirmar, aún dudando..."
              className="flex-1 border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#F3F6F9] text-slate text-sm font-medium rounded-xl hover:bg-fog transition-colors shrink-0"
            >
              Guardar
            </button>
          </form>
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
          <h2 className="text-sm font-semibold text-ink mb-4">Historial</h2>
          <ol className="space-y-3">
            {[...events].reverse().map((ev) => (
              <li key={ev.id} className="flex items-start gap-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 mt-0.5 ${EVENT_COLOR[ev.event_type] ?? 'bg-[#F3F6F9] text-slate'}`}>
                  {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                </span>
                <div className="flex-1 min-w-0">
                  {typeof ev.details?.note === 'string' && (
                    <p className="text-sm text-slate">{ev.details.note}</p>
                  )}
                  {typeof ev.details?.from === 'string' && typeof ev.details?.to === 'string' && (
                    <p className="text-xs text-slate">
                      {STATUS_LABEL[ev.details.from as IntakeStatus] ?? ev.details.from}
                      {' → '}
                      {STATUS_LABEL[ev.details.to as IntakeStatus] ?? ev.details.to}
                    </p>
                  )}
                  <p className="text-xs text-slate mt-0.5">
                    {new Date(ev.created_at).toLocaleString('es-PE', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                    {ev.actor !== 'system' && ev.actor !== 'staff' && ` · ${ev.actor}`}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 60)  return `hace ${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs  < 24)  return `hace ${hrs}h`
  return `hace ${Math.round(hrs / 24)}d`
}

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const mins = Math.round(diff / 60_000)
  if (mins < 60)  return `en ${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs  < 24)  return `en ${hrs}h`
  return `en ${Math.round(hrs / 24)}d`
}
