import { PatientForm } from '@/components/patient/patient-form'
import { createPatient } from '@/app/actions/patients'

export default function NewPatientPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo paciente</h1>
        <p className="text-sm text-gray-500 mt-0.5">Completa los datos del paciente</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <PatientForm action={createPatient} />
      </div>
    </div>
  )
}
