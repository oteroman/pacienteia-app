import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { getActiveContext }   from '@/lib/tenant/context'
import { AppointmentStatusBadge } from '@/components/appointment/appointment-status-badge'
import { updateAppointmentStatus, cancelAppointment } from '@/app/actions/appointments'
import { confirmPaymentManual } from '@/app/actions/payment-settings'
import AppointmentNotesEditor from './AppointmentNotesEditor'
import type { AppointmentStatus } from '@/types/database'

interface PageProps { params: Promise<{ id: string }> }

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pago pendiente',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid:    { label: 'Pago confirmado',  cls: 'bg-lima-100 text-lima-700 border-lima-200' },
  expired: { label: 'Pago vencido',     cls: 'bg-red-100   text-red-700   border-red-200'   },
}

export default async function AppointmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getActiveContext()
  if (!ctx?.organizationId) redirect('/org-selector')

  // Use admin client so RLS doesn't block cross-branch visibility for superadmins
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [{ data }, { data: eventsData }] = await Promise.all([
    sb.from('appointments')
      .select('*, patients(id, full_name, phone), professionals(id, name, color)')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .single(),
    sb.from('appointment_events')
      .select('id, event_type, details, actor, created_at')
      .eq('appointment_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!data) notFound()

  type AptEvent = { id: string; event_type: string; details: Record<string, string>; actor: string; created_at: string }
  const events: AptEvent[] = eventsData ?? []

  const apt = data as {
    id: string; treatment_type: string; scheduled_at: string
    status: AppointmentStatus; price: number | null; notes: string | null
    payment_status: string; payment_link: string | null; payment_paid_at: string | null
    patients:      { id: string; full_name: string; phone: string | null } | null
    professionals: { id: string; name: string; color: string } | null
  }

  const canConfirm  = apt.status === 'scheduled'
  const canMarkDone = apt.status === 'scheduled' || apt.status === 'confirmed'
  const canCancel   = apt.status === 'scheduled' || apt.status === 'confirmed'
  const paymentBadge = PAYMENT_BADGE[apt.payment_status]

  async function confirm()        { 'use server'; await updateAppointmentStatus(id, 'confirmed')  }
  async function markCompleted()  { 'use server'; await updateAppointmentStatus(id, 'completed')  }
  async function markNoShow()     { 'use server'; await updateAppointmentStatus(id, 'no_show')    }
  async function cancel()         { 'use server'; await cancelAppointment(id)                     }
  async function markPaid()       { 'use server'; await confirmPaymentManual(id)                  }

  const backHref = apt.patients ? `/patients/${apt.patients.id}` : '/appointments'

  const EVENT_LABEL: Record<string, string> = {
    created:          'Cita creada',
    status_changed:   'Estado actualizado',
    notes_updated:    'Notas actualizadas',
    rescheduled:      'Cita reagendada',
    payment_received: 'Pago confirmado',
    cancelled:        'Cita cancelada',
  }
  const STATUS_LABEL: Record<string, string> = {
    scheduled:  'Programada', confirmed: 'Confirmada', completed: 'Atendida',
    no_show:    'Inasistencia', cancelled: 'Cancelada',
  }
  const EVENT_COLOR: Record<string, string> = {
    created:          'bg-brand-500',
    status_changed:   'bg-blue-400',
    notes_updated:    'bg-gray-400',
    rescheduled:      'bg-purple-400',
    payment_received: 'bg-lima-500',
    cancelled:        'bg-red-400',
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="text-sm text-slate hover:text-slate transition-colors">
          ← Volver
        </Link>
        <Link
          href={`/appointments/${apt.id}/edit`}
          className="text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50"
        >
          Editar cita
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">{apt.treatment_type}</h1>
            <p className="text-sm text-slate mt-1">
              {new Date(apt.scheduled_at).toLocaleDateString('es-PE', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              })}
              {' · '}
              {new Date(apt.scheduled_at).toLocaleTimeString('es-PE', {
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          <AppointmentStatusBadge status={apt.status} />
        </div>

        {/* Details grid */}
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {apt.patients && (
            <div>
              <dt className="text-xs text-slate mb-0.5">Paciente</dt>
              <dd>
                <Link href={`/patients/${apt.patients.id}`}
                  className="text-brand-600 font-medium hover:underline">
                  {apt.patients.full_name}
                </Link>
                {apt.patients.phone && (
                  <p className="text-xs text-slate mt-0.5">{apt.patients.phone}</p>
                )}
              </dd>
            </div>
          )}
          {apt.professionals && (
            <div>
              <dt className="text-xs text-slate mb-0.5">Profesional</dt>
              <dd className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: apt.professionals.color }}
                />
                <span className="font-medium text-ink">{apt.professionals.name}</span>
              </dd>
            </div>
          )}
          {apt.price != null && (
            <div>
              <dt className="text-xs text-slate mb-0.5">Precio</dt>
              <dd className="font-medium text-ink">S/ {Number(apt.price).toFixed(0)}</dd>
            </div>
          )}
        </dl>

        {/* Payment section */}
        {apt.payment_status !== 'none' && (
          <div className="pt-4 border-t border-fog space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate font-medium">Separación de cita</p>
              {paymentBadge && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${paymentBadge.cls}`}>
                  {paymentBadge.label}
                </span>
              )}
            </div>

            {apt.payment_status === 'paid' && apt.payment_paid_at && (
              <p className="text-xs text-lima-600">
                Pagado el {new Date(apt.payment_paid_at).toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })} a las {new Date(apt.payment_paid_at).toLocaleTimeString('es-PE', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}

            {apt.payment_link && (
              <a
                href={apt.payment_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline"
              >
                Ver link de pago Niubiz →
              </a>
            )}

            {apt.payment_status === 'pending' && (
              <form action={markPaid}>
                <button
                  type="submit"
                  className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  ✓ Marcar pago recibido (Yape/Plin)
                </button>
              </form>
            )}
          </div>
        )}

        {/* Notes — inline editor */}
        <div className="pt-2 border-t border-fog">
          <AppointmentNotesEditor appointmentId={apt.id} initialNotes={apt.notes} />
        </div>

        {/* Status change actions */}
        {(canConfirm || canMarkDone || canCancel) && (
          <div className="pt-4 border-t border-fog">
            <p className="text-xs text-slate font-medium mb-3">Cambiar estado</p>
            <div className="flex flex-wrap gap-2">
              {canConfirm && (
                <form action={confirm}>
                  <button type="submit"
                    className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg
                               hover:bg-blue-700 transition-colors">
                    Confirmar
                  </button>
                </form>
              )}
              {canMarkDone && (
                <form action={markCompleted}>
                  <button type="submit"
                    className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-lg
                               hover:bg-green-700 transition-colors">
                    ✓ Vino
                  </button>
                </form>
              )}
              {canMarkDone && (
                <form action={markNoShow}>
                  <button type="submit"
                    className="text-sm font-semibold bg-amber-500 text-white px-4 py-2 rounded-lg
                               hover:bg-amber-600 transition-colors">
                    ✗ No vino
                  </button>
                </form>
              )}
              {canCancel && (
                <form action={cancel}>
                  <button type="submit"
                    className="text-sm font-semibold border border-red-200 text-red-600 px-4 py-2
                               rounded-lg hover:bg-red-50 transition-colors">
                    Cancelar cita
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audit trail */}
      {events.length > 0 && (
        <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
          <h2 className="text-sm font-semibold text-slate mb-4">Historial de cambios</h2>
          <div className="space-y-3">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${EVENT_COLOR[ev.event_type] ?? 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate">{EVENT_LABEL[ev.event_type] ?? ev.event_type}</p>
                  {ev.details?.status && (
                    <p className="text-xs text-slate">{STATUS_LABEL[ev.details.status] ?? ev.details.status}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate">{timeAgo(ev.created_at)}</p>
                  {ev.actor !== 'system' && (
                    <p className="text-[10px] text-fog truncate max-w-[120px]">{ev.actor}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
