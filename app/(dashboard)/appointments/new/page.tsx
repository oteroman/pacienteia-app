import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/tenant/context'
import { AppointmentForm } from '@/components/appointment/appointment-form'
import { createAppointment } from '@/app/actions/appointments'

interface PageProps {
  searchParams: Promise<{ date?: string; patient_id?: string; professional_id?: string; time?: string }>
}

export default async function NewAppointmentPage({ searchParams }: PageProps) {
  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId, branchId } = ctx

  const { date, patient_id, professional_id, time } = await searchParams
  // Combine date + time into a single datetime string for the form
  const defaultDate = date && time ? `${date}T${time}` : date

  const supabase = await createClient()
  const [prosRes, svcsRes] = await Promise.all([
    (supabase as any)
      .from('professionals')
      .select('id, name, color')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name'),
    (supabase as any)
      .from('services')
      .select('id, name, price, duration_min')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name'),
  ])
  const professionals = prosRes.data ?? []
  const services      = svcsRes.data ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Nueva cita</h1>
        <p className="text-sm text-slate mt-0.5">Programa una cita para un paciente</p>
      </div>
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
        <AppointmentForm
          defaultDate={defaultDate}
          defaultPatientId={patient_id}
          defaultProfessionalId={professional_id}
          organizationId={organizationId}
          professionals={professionals}
          services={services}
          action={createAppointment}
        />
      </div>
    </div>
  )
}
