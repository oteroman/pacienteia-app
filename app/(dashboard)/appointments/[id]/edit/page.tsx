import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { getActiveContext } from '@/lib/tenant/context'
import { updateAppointment } from '@/app/actions/appointments'
import type { AppointmentFormValues } from '@/lib/validations/appointment'

interface PageProps { params: Promise<{ id: string }> }

const STATUS_OPTIONS = [
  { value: 'scheduled',  label: 'Programada — pendiente de confirmación' },
  { value: 'confirmed',  label: 'Confirmada — paciente confirmó asistencia' },
  { value: 'completed',  label: 'Atendida — paciente fue atendido' },
  { value: 'no_show',    label: 'Inasistencia — no se presentó sin aviso' },
  { value: 'cancelled',  label: 'Cancelada — canceló con anticipación' },
] as const

const inputCls = 'w-full border border-fog rounded-xl px-3 py-2.5 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300'

export default async function EditAppointmentPage({ params }: PageProps) {
  const { id } = await params
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const ctx = await getActiveContext()
  const branchId = ctx?.branchId

  const supabase = await createClient()
  const [aptRes, prosRes] = await Promise.all([
    (supabase as any)
      .from('appointments')
      .select('*, patients(id, full_name)')
      .eq('id', id)
      .eq('organization_id', clinicId)
      .is('deleted_at', null)
      .single(),
    branchId
      ? (supabase as any)
          .from('professionals')
          .select('id, name, color')
          .eq('organization_id', clinicId)
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .order('name')
      : Promise.resolve({ data: [] }),
  ])

  const data = aptRes.data
  if (!data) notFound()
  const professionals: { id: string; name: string; color: string }[] = prosRes.data ?? []

  const localDatetime = new Date(data.scheduled_at)
    .toLocaleString('sv-SE', { timeZone: 'America/Lima' })
    .replace(' ', 'T')
    .slice(0, 16)

  async function handleUpdate(formData: FormData) {
    'use server'
    const values: AppointmentFormValues = {
      patient_id:      data.patient_id,
      treatment_type:  (formData.get('treatment_type') as string).trim(),
      scheduled_at:    formData.get('scheduled_at') as string,
      status:          formData.get('status') as AppointmentFormValues['status'],
      notes:           (formData.get('notes') as string) || '',
      price:           formData.get('price') ? Number(formData.get('price')) : undefined,
      professional_id: (formData.get('professional_id') as string) || '',
    }
    await updateAppointment(id, values)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/appointments/${id}`} className="text-sm text-slate hover:text-slate transition-colors">
          ← Volver
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-ink">Editar cita</h1>
        {data.patients && (
          <p className="text-sm text-slate mt-0.5">
            Paciente:{' '}
            <Link href={`/patients/${data.patients.id}`} className="text-brand-600 hover:underline font-medium">
              {data.patients.full_name}
            </Link>
          </p>
        )}
      </div>

      <form action={handleUpdate} className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-5">

        {/* Tratamiento */}
        <div>
          <label className="block text-sm font-medium text-slate mb-1">
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
          <label className="block text-sm font-medium text-slate mb-1">
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
          <label className="block text-sm font-medium text-slate mb-1">Estado</label>
          <select name="status" defaultValue={data.status} className={inputCls}>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate mt-1">
            Puedes corregir el estado si fue registrado incorrectamente.
          </p>
        </div>

        {/* Precio */}
        <div>
          <label className="block text-sm font-medium text-slate mb-1">Precio (S/)</label>
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

        {/* Profesional */}
        {professionals.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate mb-1">Profesional</label>
            <select name="professional_id" defaultValue={data.professional_id ?? ''} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-slate mb-1">Notas internas</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={data.notes ?? ''}
            placeholder="Observaciones, indicaciones, preparación especial..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-fog">
          <Link
            href={`/appointments/${id}`}
            className="px-4 py-2.5 text-sm font-medium text-slate border border-fog rounded-xl hover:bg-mist transition-colors"
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
