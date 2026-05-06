import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { PatientStatusBadge } from '@/components/patient/patient-status-badge'
import { AppointmentStatusBadge } from '@/components/appointment/appointment-status-badge'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/button'
import { cancelAppointment } from '@/app/actions/appointments'
import type { Patient, Appointment, AppointmentStatus, PatientStatus } from '@/types/database'

interface PageProps { params: Promise<{ id: string }> }

export default async function PatientDetailPage({ params }: PageProps) {
  const { id } = await params
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const supabase = await createClient()

  const { data: patientData } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .single()

  if (!patientData) notFound()
  const patient = patientData as Patient

  const { data: aptData } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', id)
    .eq('clinic_id', clinicId)
    .order('scheduled_at', { ascending: false })
    .limit(20)

  const appointments = (aptData ?? []) as Appointment[]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            {patient.photo_url ? (
              <Image src={patient.photo_url} alt={patient.full_name} fill className="object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                {patient.full_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <PatientStatusBadge status={patient.status as PatientStatus} />
              {(patient.tags ?? []).map((t) => <Badge key={t} variant="blue">{t}</Badge>)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <LinkButton href={`/appointments/new?patient_id=${patient.id}`} size="sm">+ Cita</LinkButton>
          <LinkButton href={`/patients/${patient.id}/edit`} variant="secondary" size="sm">Editar</LinkButton>
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Información de contacto</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Teléfono', value: patient.phone },
            { label: 'Email', value: patient.email },
            { label: 'DNI', value: patient.dni },
            { label: 'Última visita', value: patient.last_visit_date ? new Date(patient.last_visit_date).toLocaleDateString('es-PE') : null },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
              <dd className="font-medium text-gray-800">{value ?? <span className="text-gray-300">—</span>}</dd>
            </div>
          ))}
        </dl>
        {patient.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs text-gray-400 mb-1">Notas</dt>
            <dd className="text-sm text-gray-700 whitespace-pre-line">{patient.notes}</dd>
          </div>
        )}
      </div>

      {/* Appointment timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Historial de citas</h2>
          <span className="text-xs text-gray-400">{appointments.length} cita{appointments.length !== 1 ? 's' : ''}</span>
        </div>
        {appointments.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Sin citas registradas</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {appointments.map((apt) => {
              async function cancel() {
                'use server'
                await cancelAppointment(apt.id)
              }
              return (
                <li key={apt.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{apt.treatment_type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(apt.scheduled_at).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}
                      {new Date(apt.scheduled_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {apt.price && <span className="text-sm text-gray-500">S/ {Number(apt.price).toFixed(0)}</span>}
                    <AppointmentStatusBadge status={apt.status as AppointmentStatus} />
                    {(apt.status === 'scheduled' || apt.status === 'confirmed') && (
                      <form action={cancel}>
                        <button type="submit" className="text-xs text-gray-400 hover:text-red-600 transition-colors">
                          Cancelar
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Link href="/patients" className="text-sm text-gray-400 hover:text-gray-600">← Volver a pacientes</Link>
    </div>
  )
}
