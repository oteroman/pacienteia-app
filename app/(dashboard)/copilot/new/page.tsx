import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { submitInteraction } from '@/app/actions/copilot'
import type { SourceType } from '@/lib/copilot/index'
import { SOURCE_LABELS } from '@/lib/copilot/index'
import Link from 'next/link'

const SOURCE_TYPES: SourceType[] = ['whatsapp_text', 'whatsapp_audio', 'phone_call', 'staff_note', 'chat']

export default async function NewInteractionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbClient = await createClient() as any
  const { data: patientsRaw } = await sbClient
    .from('patients')
    .select('id, full_name')
    .eq('organization_id', clinicId)
    .order('full_name')
    .limit(200)
  const patients = (patientsRaw ?? []) as { id: string; full_name: string }[]

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div className="flex items-center gap-3">
        <Link href="/copilot" className="text-sm text-gray-400 hover:text-gray-600">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva interacción</h1>
      </div>

      <form action={submitInteraction} className="space-y-5">

        {/* Source type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de interacción
          </label>
          <div className="flex flex-wrap gap-2">
            {SOURCE_TYPES.map((type) => (
              <label key={type} className="cursor-pointer">
                <input
                  type="radio"
                  name="source_type"
                  value={type}
                  defaultChecked={type === 'whatsapp_text'}
                  className="sr-only peer"
                />
                <span className="block px-3 py-1.5 rounded-lg border text-sm font-medium
                  peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700
                  border-gray-200 text-gray-600 hover:border-gray-300 transition-colors">
                  {SOURCE_LABELS[type]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Patient (optional) */}
        <div>
          <label htmlFor="patient_id" className="block text-sm font-medium text-gray-700 mb-1">
            Paciente <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            id="patient_id"
            name="patient_id"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value="">— Sin paciente específico —</option>
            {(patients ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>

        {/* Raw content */}
        <div>
          <label htmlFor="raw_content" className="block text-sm font-medium text-gray-700 mb-1">
            Contenido
          </label>
          <textarea
            id="raw_content"
            name="raw_content"
            rows={8}
            required
            minLength={5}
            placeholder="Pega aquí el mensaje de WhatsApp, transcripción de llamada o nota del staff..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            El copiloto analizará el texto y extraerá compromisos, riesgos y tareas automáticamente.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Analizar y guardar
          </button>
          <Link
            href="/copilot"
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </Link>
        </div>

      </form>
    </div>
  )
}
