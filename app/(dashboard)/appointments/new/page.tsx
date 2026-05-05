import { redirect } from 'next/navigation'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { AppointmentForm } from '@/components/appointment/appointment-form'
import { createAppointment } from '@/app/actions/appointments'

interface PageProps {
  searchParams: Promise<{ date?: string; patient_id?: string }>
}

export default async function NewAppointmentPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const { date, patient_id } = await searchParams

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva cita</h1>
        <p className="text-sm text-gray-500 mt-0.5">Programa una cita para un paciente</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <AppointmentForm
          defaultDate={date}
          defaultPatientId={patient_id}
          clinicId={clinicId}
          action={createAppointment}
        />
      </div>
    </div>
  )
}
