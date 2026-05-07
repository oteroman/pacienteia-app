import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { submitManualIntake } from '@/app/actions/intake'
import { CHANNEL_LABELS } from '@/lib/intake/index'
import type { IntakeChannel } from '@/lib/intake/index'

const CHANNELS: IntakeChannel[] = ['whatsapp', 'call', 'webform', 'instagram', 'facebook', 'tiktok', 'manual']

export default async function NewIntakePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div className="flex items-center gap-3">
        <Link href="/inbox" className="text-sm text-gray-400 hover:text-gray-600">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Registrar entrada</h1>
      </div>

      <form action={submitManualIntake} className="space-y-5 bg-white rounded-2xl border p-6">

        {/* Channel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Canal de origen</label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <label key={ch} className="cursor-pointer">
                <input
                  type="radio"
                  name="source_channel"
                  value={ch}
                  defaultChecked={ch === 'whatsapp'}
                  className="sr-only peer"
                />
                <span className="block px-3 py-1.5 rounded-lg border text-sm font-medium
                  peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700
                  border-gray-200 text-gray-600 hover:border-gray-300 transition-colors">
                  {CHANNEL_LABELS[ch]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="contact_name" className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
            <input
              id="contact_name"
              name="contact_name"
              type="text"
              placeholder="Nombre del contacto"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <div>
            <label htmlFor="contact_phone" className="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
            <input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              placeholder="+51 9xx xxx xxx"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <div>
            <label htmlFor="contact_email" className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              placeholder="correo@ejemplo.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="raw_content" className="block text-sm font-medium text-gray-700 mb-1">
            Mensaje / transcripción
          </label>
          <textarea
            id="raw_content"
            name="raw_content"
            rows={7}
            required
            minLength={3}
            placeholder="Pega el mensaje de WhatsApp, transcripción de la llamada, contenido del formulario..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            La IA detectará intención, prioridad y creará tareas automáticamente si hace falta.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            className="flex-1 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Analizar y registrar
          </button>
          <Link
            href="/inbox"
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </Link>
        </div>

      </form>
    </div>
  )
}
