import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { PatientForm } from '@/components/patient/patient-form'
import { updatePatient } from '@/app/actions/patients'
import type { Patient } from '@/types/database'

interface PageProps { params: Promise<{ id: string }> }

export default async function EditPatientPage({ params }: PageProps) {
  const { id } = await params
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', clinicId)
    .is('deleted_at', null)
    .single()

  if (!data) notFound()
  const patient = data as Patient

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Editar paciente</h1>
        <p className="text-sm text-slate mt-0.5">{patient.full_name}</p>
      </div>
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
        <PatientForm
          defaultValues={patient}
          action={updatePatient.bind(null, id)}
        />
      </div>
    </div>
  )
}
