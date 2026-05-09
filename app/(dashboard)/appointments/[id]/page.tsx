import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { AppointmentStatusBadge } from '@/components/appointment/appointment-status-badge'
import { updateAppointmentStatus, cancelAppointment } from '@/app/actions/appointments'
import type { AppointmentStatus } from '@/types/database'

interface PageProps { params: Promise<{ id: string }> }

export default async function AppointmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const supabase = await createClient()

  const { data } = await (supabase as any)
    .from('appointments')
    .select('*, patients(id, full_name, phone)')
    .eq('id', id)
    .eq('organization_id', clinicId)
    .is('deleted_at', null)
    .single()

  if (!data) notFound()

  const apt = data as {
    id: string; treatment_type: string; scheduled_at: string
    status: AppointmentStatus; price: number | null; notes: string | null
    patients: { id: string; full_name: string; phone: string | null } | null
  }

  const canConfirm  = apt.status === 'scheduled'
  const canMarkDone = apt.status === 'scheduled' || apt.status === 'confirmed'
  const canCancel   = apt.status === 'scheduled' || apt.status === 'confirmed'

  async function confirm()        { 'use server'; await updateAppointmentStatus(id, 'confirmed')  }
  async function markCompleted()  { 'use server'; await updateAppointmentStatus(id, 'completed')  }
  async function markNoShow()     { 'use server'; await updateAppointmentStatus(id, 'no_show')    }
  async function cancel()         { 'use server'; await cancelAppointment(id)                     }

  const backHref = apt.patients ? `/patients/${apt.patients.id}` : '/appointments'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Volver
        </Link>
        <Link
          href={`/appointments/${apt.id}/edit`}
          className="text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50"
        >
          Editar cita
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{apt.treatment_type}</h1>
            <p className="text-sm text-gray-500 mt-1">
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
              <dt className="text-xs text-gray-400 mb-0.5">Paciente</dt>
              <dd>
                <Link href={`/patients/${apt.patients.id}`}
                  className="text-brand-600 font-medium hover:underline">
                  {apt.patients.full_name}
                </Link>
                {apt.patients.phone && (
                  <p className="text-xs text-gray-400 mt-0.5">{apt.patients.phone}</p>
                )}
              </dd>
            </div>
          )}
          {apt.price != null && (
            <div>
              <dt className="text-xs text-gray-400 mb-0.5">Precio</dt>
              <dd className="font-medium text-gray-900">S/ {Number(apt.price).toFixed(0)}</dd>
            </div>
          )}
        </dl>

        {/* Notes */}
        {apt.notes && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Notas</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 whitespace-pre-line leading-relaxed">
              {apt.notes}
            </p>
          </div>
        )}

        {/* Status change actions */}
        {(canConfirm || canMarkDone || canCancel) && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-3">Cambiar estado</p>
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
    </div>
  )
}
