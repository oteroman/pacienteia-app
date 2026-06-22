import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient }           from '@/lib/supabase/server'
import { createAdminClient }      from '@/lib/supabase/admin'
import { getActiveContext }       from '@/lib/tenant/context'
import { PatientStatusBadge }     from '@/components/patient/patient-status-badge'
import { AppointmentStatusBadge } from '@/components/appointment/appointment-status-badge'
import { Badge }                  from '@/components/ui/badge'
import { LinkButton }             from '@/components/ui/button'
import { PatientPhotos }          from '@/components/patient/patient-photos'
import { buildRetentionStats, calculateRetentionScore } from '@/lib/analytics/retention'
import type { Patient, Appointment, AppointmentStatus, PatientStatus } from '@/types/database'

interface PageProps { params: Promise<{ id: string }> }

const INTENT_BADGE: Record<string, string> = {
  cancel_intent:          'bg-red-100 text-red-700',
  reschedule_intent:      'bg-orange-100 text-orange-700',
  price_inquiry:          'bg-blue-100 text-blue-700',
  dissatisfaction:        'bg-red-100 text-red-700',
  medical_urgency:        'bg-red-200 text-red-800',
  appointment_request:    'bg-lima-100 text-lima-700',
  multi_service_interest: 'bg-ai-100 text-ai-600',
  general_inquiry:        'bg-[#F3F6F9] text-slate',
  positive_response:      'bg-lima-100 text-lima-700',
}
const INTENT_LABEL: Record<string, string> = {
  cancel_intent:          'Cancela',
  reschedule_intent:      'Reagenda',
  price_inquiry:          'Precios',
  dissatisfaction:        'Insatisfecho',
  medical_urgency:        'Urgencia',
  appointment_request:    'Pide cita',
  multi_service_interest: 'Cross-sell',
  general_inquiry:        'Consulta',
  positive_response:      'Positivo',
}

export default async function PatientDetailPage({ params }: PageProps) {
  const { id } = await params

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId, branchId } = ctx

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: patientData } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (!patientData) notFound()
  const patient = patientData as Patient & {
    abandonment_risk?: number | null
    abandonment_risk_at?: string | null
  }

  const [
    { data: aptData },
    { data: convData },
    { data: campaignData },
    { data: taskData },
    { data: flashData },
    { data: photoData },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, professionals(id, name, color)')
      .eq('patient_id', id)
      .eq('organization_id', organizationId)
      .order('scheduled_at', { ascending: false })
      .limit(20),

    // Cross-branch: patient may have activity in multiple branches of the same org
    sb
      .from('conversations')
      .select('id, branch_id, channel, status, last_message_at, last_message_preview, last_intent')
      .eq('organization_id', organizationId)
      .eq('patient_id', id)
      .order('last_message_at', { ascending: false })
      .limit(5),

    sb
      .from('reactivation_campaigns')
      .select('id, step, status, sent_at, responded_at')
      .eq('organization_id', organizationId)
      .eq('patient_id', id)
      .order('sent_at', { ascending: false })
      .limit(10),

    sb
      .from('copilot_tasks')
      .select('id, title, status, priority, created_at, source')
      .eq('organization_id', organizationId)
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .limit(5),

    sb
      .from('flash_offers')
      .select('id, slot_at, discount_pct, status, sent_at')
      .eq('organization_id', organizationId)
      .eq('patient_id', id)
      .order('sent_at', { ascending: false })
      .limit(5),

    sb
      .from('patient_photos')
      .select('id, photo_url, type, label, taken_at')
      .eq('organization_id', organizationId)
      .eq('patient_id', id)
      .order('taken_at', { ascending: false }),
  ])

  const appointments = (aptData ?? []) as (Appointment & { professionals?: { id: string; name: string; color: string } | null })[]
  const photos = (photoData ?? []) as { id: string; photo_url: string; type: 'before' | 'after' | 'general'; label: string | null; taken_at: string }[]
  const conversations = (convData ?? []) as {
    id: string; channel: string; status: string; last_message_at: string
    last_message_preview: string | null; last_intent: string | null
  }[]
  const campaigns = (campaignData ?? []) as {
    id: string; step: number; status: string; sent_at: string; responded_at: string | null
  }[]
  const tasks = (taskData ?? []) as {
    id: string; title: string; status: string; priority: string; created_at: string; source: string
  }[]
  const flashOffers = (flashData ?? []) as {
    id: string; slot_at: string; discount_pct: number; status: string; sent_at: string
  }[]

  const retentionStats = buildRetentionStats(appointments.map(a => ({ status: a.status, scheduled_at: a.scheduled_at })))
  const retention = calculateRetentionScore(retentionStats)

  const abandonmentRisk = patient.abandonment_risk ?? null

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full bg-[#F3F6F9] overflow-hidden flex-shrink-0">
            {patient.photo_url ? (
              <Image src={patient.photo_url} alt={patient.full_name} fill className="object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-slate text-2xl font-bold">
                {patient.full_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">{patient.full_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <PatientStatusBadge status={patient.status as PatientStatus} />
              {(patient.tags ?? []).map((t) => <Badge key={t} variant="blue">{t}</Badge>)}
              {abandonmentRisk !== null && abandonmentRisk >= 65 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${abandonmentRisk >= 80 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  ⚠ Riesgo {abandonmentRisk}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <LinkButton href={`/appointments/new?patient_id=${patient.id}`} size="sm">+ Cita</LinkButton>
          <LinkButton href={`/patients/${patient.id}/consent`} variant="secondary" size="sm">📄 Consentimiento</LinkButton>
          <LinkButton href={`/patients/${patient.id}/edit`} variant="secondary" size="sm">Editar</LinkButton>
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-5">
        <h2 className="text-sm font-semibold text-slate mb-4">Información de contacto</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Teléfono', value: patient.phone },
            { label: 'Email', value: patient.email },
            { label: 'DNI', value: patient.dni },
            { label: 'Última visita', value: patient.last_visit_date ? new Date(patient.last_visit_date).toLocaleDateString('es-PE') : null },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-slate mb-0.5">{label}</dt>
              <dd className="font-medium text-ink">{value ?? <span className="text-fog">—</span>}</dd>
            </div>
          ))}
        </dl>
        {(patient as any).contraindications && (
          <div className="mt-4 pt-4 border-t border-fog">
            <dt className="text-xs font-semibold text-red-600 mb-1">⚠ Contraindicaciones / Alergias</dt>
            <dd className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 whitespace-pre-line">
              {(patient as any).contraindications}
            </dd>
          </div>
        )}
        {patient.notes && (
          <div className="mt-4 pt-4 border-t border-fog">
            <dt className="text-xs text-slate mb-1">Notas</dt>
            <dd className="text-sm text-slate whitespace-pre-line">{patient.notes}</dd>
          </div>
        )}
      </div>

      {/* Retention score + Abandonment risk */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Score de retención</h2>
          <div className="flex items-center gap-2">
            {abandonmentRisk !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                abandonmentRisk >= 80 ? 'bg-red-100 text-red-700'
                  : abandonmentRisk >= 65 ? 'bg-orange-100 text-orange-700'
                  : 'bg-lima-100 text-lima-700'
              }`}>
                Abandono {abandonmentRisk}%
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${retention.badgeCls}`}>
              {retention.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0 text-center">
            <p className="text-4xl font-bold text-ink">{retention.score}</p>
            <p className="text-xs text-slate mt-0.5">/ 100</p>
          </div>
          <div className="flex-1 space-y-3">
            <div className="w-full bg-[#F3F6F9] rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${retention.barCls}`} style={{ width: `${retention.score}%` }} />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate">Total citas</dt>
                <dd className="font-medium text-ink">{retentionStats.totalAppointments}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Inasistencias</dt>
                <dd className="font-medium text-ink">{retentionStats.noShows}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Días desde última visita</dt>
                <dd className="font-medium text-ink">
                  {retentionStats.daysSinceLastAppointment !== null
                    ? `${retentionStats.daysSinceLastAppointment} días`
                    : <span className="text-fog">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Cita próxima</dt>
                <dd className={`font-medium ${retentionStats.hasFutureAppointment ? 'text-lima-600' : 'text-ink'}`}>
                  {retentionStats.hasFutureAppointment ? 'Sí ✓' : 'No'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Tareas Copilot */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-fog shadow-xs">
          <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
            <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Tareas IA relacionadas</h2>
            <span className="text-xs text-slate">{tasks.length}</span>
          </div>
          <ul className="divide-y divide-fog">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/copilot/tasks/${t.id}`} className="px-5 py-3 flex items-start justify-between hover:bg-mist transition-colors group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink line-clamp-1 group-hover:text-brand-700">{t.title}</p>
                    <p className="text-xs text-slate mt-0.5">
                      {new Date(t.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      {' · '}{t.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      t.priority === 'high' ? 'bg-red-100 text-red-700'
                        : t.priority === 'medium' ? 'bg-orange-100 text-orange-700'
                        : 'bg-[#F3F6F9] text-slate'
                    }`}>{t.priority}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      t.status === 'open' ? 'bg-blue-100 text-blue-700'
                        : t.status === 'done' ? 'bg-lima-100 text-lima-700'
                        : 'bg-[#F3F6F9] text-slate'
                    }`}>{t.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conversaciones WhatsApp */}
      {conversations.length > 0 && (
        <div className="bg-white rounded-2xl border border-fog shadow-xs">
          <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
            <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Conversaciones WhatsApp</h2>
            <span className="text-xs text-slate">{conversations.length}</span>
          </div>
          <ul className="divide-y divide-fog">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/inbox/conversations/${c.id}`} className="px-5 py-3 flex items-start justify-between hover:bg-mist transition-colors group">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate mb-0.5">
                      {new Date(c.last_message_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </p>
                    <p className="text-sm text-slate line-clamp-1">{c.last_message_preview ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {c.last_intent && INTENT_BADGE[c.last_intent] && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${INTENT_BADGE[c.last_intent]}`}>
                        {INTENT_LABEL[c.last_intent] ?? c.last_intent}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      c.status === 'open' ? 'bg-lima-100 text-lima-700' : 'bg-[#F3F6F9] text-slate'
                    }`}>{c.status}</span>
                    <span className="text-fog text-xs">›</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Campañas de reactivación + Flash offers */}
      {(campaigns.length > 0 || flashOffers.length > 0) && (
        <div className="bg-white rounded-2xl border border-fog shadow-xs p-5 space-y-5">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Campañas automáticas recibidas</h2>

          {campaigns.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">Reactivación</p>
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-xs font-medium text-slate">Paso {c.step}</span>
                    <span className="text-xs text-slate ml-2">
                      {new Date(c.sent_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.responded_at && <span className="text-[10px] text-lima-600 font-medium">Respondió ✓</span>}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      c.status === 'responded' ? 'bg-lima-100 text-lima-700'
                        : c.status === 'sent' ? 'bg-blue-100 text-blue-700'
                        : 'bg-[#F3F6F9] text-slate'
                    }`}>{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {flashOffers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">Ofertas flash</p>
              {flashOffers.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-xs font-medium text-slate">
                      {new Date(f.slot_at).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                    <span className="text-xs text-slate ml-2">{f.discount_pct}% dto</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    f.status === 'accepted' ? 'bg-lima-100 text-lima-700'
                      : f.status === 'expired' ? 'bg-[#F3F6F9] text-slate'
                      : 'bg-blue-100 text-blue-700'
                  }`}>{f.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fotos antes/después */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-5">
        <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em] mb-4">
          Fotos antes / después
        </h2>
        <PatientPhotos patientId={patient.id} initialPhotos={photos} />
      </div>

      {/* Appointment timeline */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs">
        <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Historial de citas</h2>
          <span className="text-xs text-slate">{appointments.length} cita{appointments.length !== 1 ? 's' : ''}</span>
        </div>
        {appointments.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate text-center">Sin citas registradas</p>
        ) : (
          <ul className="divide-y divide-fog">
            {appointments.map((apt) => (
              <li key={apt.id}>
                <Link
                  href={`/appointments/${apt.id}`}
                  className="px-5 py-4 flex items-start justify-between hover:bg-mist transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink group-hover:text-brand-700 transition-colors">
                      {apt.treatment_type}
                    </p>
                    <p className="text-xs text-slate mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>
                        {new Date(apt.scheduled_at).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        {' · '}
                        {new Date(apt.scheduled_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {apt.professionals && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: apt.professionals.color }} />
                          <span>{apt.professionals.name}</span>
                        </span>
                      )}
                    </p>
                    {(apt as any).notes && (
                      <p className="text-xs text-slate mt-1.5 italic bg-mist rounded-lg px-2.5 py-1.5">
                        {(apt as any).notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    {apt.price && <span className="text-sm text-slate">S/ {Number(apt.price).toFixed(0)}</span>}
                    <AppointmentStatusBadge status={apt.status as AppointmentStatus} />
                    <span className="text-fog text-xs">›</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/patients" className="text-sm text-slate hover:text-slate">← Volver a pacientes</Link>
    </div>
  )
}
