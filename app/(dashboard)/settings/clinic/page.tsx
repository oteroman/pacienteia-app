import { redirect }           from 'next/navigation'
import { createClient }       from '@/lib/supabase/server'
import { getActiveClinicId }  from '@/lib/tenant/active-clinic'
import { fetchClinicProfile } from '@/lib/clinic/profile'
import { TONE_LABELS }        from '@/lib/clinic/profile'
import type { BrandTone }     from '@/lib/clinic/profile'
import { saveClinicProfile }  from '@/app/actions/clinic-profile'

const TONES: BrandTone[] = ['casual', 'professional', 'formal', 'warm']

export default async function ClinicSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string }>
}) {
  const { guardado } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const profile = await fetchClinicProfile(clinicId)

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Perfil de clínica</h1>
        <p className="text-sm text-gray-500 mt-1">
          Estos datos se usan en las plantillas de respuesta y borradores IA.
        </p>
      </div>

      {guardado === '1' && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          Cambios guardados correctamente.
        </div>
      )}

      <form action={saveClinicProfile} className="space-y-6">

        {/* Identity */}
        <Section title="Identidad de marca">
          <Field label="Nombre comercial" hint="Cómo aparece la clínica en las respuestas">
            <input
              name="brand_name"
              type="text"
              defaultValue={profile?.brandName ?? ''}
              placeholder="Clínica Bella"
              className={inputCls}
            />
          </Field>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tono de marca <span className="text-gray-400 font-normal">(define el estilo de todas las respuestas)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((tone) => (
                <label key={tone} className="cursor-pointer">
                  <input
                    type="radio"
                    name="brand_tone"
                    value={tone}
                    defaultChecked={(profile?.brandTone ?? 'professional') === tone}
                    className="sr-only peer"
                  />
                  <span className="block px-3 py-2.5 rounded-xl border text-sm
                    peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700
                    border-gray-200 text-gray-600 hover:border-gray-300 transition-colors">
                    {TONE_LABELS[tone]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Field label="Notas de estilo" hint="Instrucciones adicionales para la IA (opcional)">
            <textarea
              name="brand_tone_notes"
              defaultValue={profile?.brandToneNotes ?? ''}
              placeholder="Ej: Evitar tecnicismos médicos. Usar lenguaje accesible. Mencionar la garantía de resultados."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>

        {/* Response defaults */}
        <Section title="Respuestas automáticas">
          <Field label="Firma por defecto" hint="Se agrega al final de cada respuesta copiada">
            <input
              name="default_signature"
              type="text"
              defaultValue={profile?.defaultSignature ?? ''}
              placeholder="El equipo de Clínica Bella ✨"
              className={inputCls}
            />
          </Field>

          <Field label="Saludo de apertura" hint="Reemplaza 'Hola [nombre],' si se define (opcional)">
            <input
              name="response_opener"
              type="text"
              defaultValue={profile?.responseOpener ?? ''}
              placeholder="Ej: Estimada [nombre],"
              className={inputCls}
            />
          </Field>
        </Section>

        {/* Contact info for auto-fill */}
        <Section title="Datos de contacto" hint="Usados para completar variables en plantillas">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="WhatsApp">
              <input name="whatsapp" type="tel" defaultValue={profile?.whatsapp ?? ''}
                placeholder="+51 9xx xxx xxx" className={inputCls} />
            </Field>
            <Field label="Teléfono">
              <input name="phone" type="tel" defaultValue={profile?.phone ?? ''}
                placeholder="+51 1 xxx xxxx" className={inputCls} />
            </Field>
          </div>

          <Field label="Dirección">
            <input name="address" type="text" defaultValue={profile?.address ?? ''}
              placeholder="Av. La Mar 123, Miraflores, Lima" className={inputCls} />
          </Field>

          <Field label="Horario de atención">
            <input name="business_hours" type="text" defaultValue={profile?.businessHours ?? ''}
              placeholder="Lun–Vie 9:00–19:00, Sáb 9:00–14:00" className={inputCls} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Sitio web">
              <input name="website" type="text" defaultValue={profile?.website ?? ''}
                placeholder="https://clinicabella.pe" className={inputCls} />
            </Field>
            <Field label="Instagram">
              <input name="instagram_handle" type="text" defaultValue={profile?.instagramHandle ?? ''}
                placeholder="@clinicabella" className={inputCls} />
            </Field>
          </div>
        </Section>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Guardar cambios
          </button>
        </div>

      </form>


    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal text-xs">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
