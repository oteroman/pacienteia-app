import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { updateAppointment } from '@/app/actions/appointments'
import type { AppointmentFormValues } from '@/lib/validations/appointment'

interface PageProps { params: Promise<{ id: string }> }

const STATUS_OPTIONS = [
  { value: 'scheduled',  label: 'Agendada — esperando confirmación' },
  { value: 'confirmed',  label: 'Confirmada — asistencia confirmada' },
  { value: 'completed',  label: 'Completada — paciente fue atendido' },
  { value: 'no_show',    label: 'No se presentó — sin aviso previo' },
  { value: 'cancelled',  label: 'Cancelada — canceló con anticipación' },
] as const

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300'

export default async function EditAppointmentPage({ params }: PageProps) {
  const { id } = await params
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('appointments')
    .select('*, patients(id, full_name)')
    .eq('id', id)
    .eq('organization_id', clinicId)
    .is('deleted_at', null)
    .single()

  if (!data) notFound()

  const localDatetime = new Date(data.scheduled_at)
    .toLocaleString('sv-SE', { timeZone: 'America/Lima' })
    .replace(' ', 'T')
    .slice(0, 16)

  async function handleUpdate(formData: FormData) {
    'use server'
    const values: AppointmentFormValues = {
      patient_id:     data.patient_id,
      treatment_type: (formData.get('treatment_type') as string).trim(),
      scheduled_at:   formData.get('scheduled_at') as string,
      status:         formData.get('status') as AppointmentFormValues['status'],
      notes:          (formData.get('notes') as string) || '',
      price:          formData.get('price') ? Number(formData.get('price')) : undefined,
    }
    await updateAppointment(id, values)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/appointments/${id}`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Volver
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar cita</h1>
        {data.patients && (
          <p className="text-sm text-gray-500 mt-0.5">
            Paciente:{' '}
            <Link href={`/patients/${data.patients.id}`} className="text-brand-600 hover:underline font-medium">
              {data.patients.full_name}
            </Link>
          </p>
        )}
      </div>

      <form action={handleUpdate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">

        {/* Tratamiento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de tratamiento / servicio <span className="text-brand-400">*</span>
          </label>
          <input
            name="treatment_type"
            type="text"
            required
            defaultValue={data.treatment_type}
            placeholder="Ej. Botox, Limpieza, Consulta"
            className={inputCls}
          />
        </div>

        {/* Fecha y hora */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha y hora <span className="text-brand-400">*</span>
          </label>
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            defaultValue={localDatetime}
            className={inputCls}
          />
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select name="status" defaultValue={data.status} className={inputCls}>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Puedes corregir el estado si fue registrado incorrectamente.
          </p>
        </div>

        {/* Precio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio (S/)</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={data.price ?? ''}
            placeholder="0.00"
            className={inputCls}
          />
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={data.notes ?? ''}
            placeholder="Observaciones, indicaciones, preparación especial..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <Link
            href={`/appointments/${id}`}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}
