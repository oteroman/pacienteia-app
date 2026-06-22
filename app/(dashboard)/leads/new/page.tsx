'use client'

import { useActionState } from 'react'
import Link               from 'next/link'
import { createManualLead } from '@/app/actions/leads'

export default function NewLeadPage() {
  const [state, action, pending] = useActionState(createManualLead, null)

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-sm text-slate hover:text-slate transition-colors">
          ← Leads
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-ink">Registrar lead manual</h1>
        <p className="text-sm text-slate mt-0.5">
          Para pacientes que pasan por el local, llaman por teléfono o consultan en persona.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-fog shadow-xs p-6">
        <form action={action} className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="contact_name" className="block text-sm font-medium text-slate">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                id="contact_name" name="contact_name" type="text" required
                placeholder="Ej. María Torres"
                className="w-full rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
                           focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact_phone" className="block text-sm font-medium text-slate">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                id="contact_phone" name="contact_phone" type="tel" required
                placeholder="+51 999 999 999"
                className="w-full rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
                           focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contact_email" className="block text-sm font-medium text-slate">
              Email <span className="text-slate font-normal">(opcional)</span>
            </label>
            <input
              id="contact_email" name="contact_email" type="email"
              placeholder="correo@ejemplo.com"
              className="w-full rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
                         focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="channel" className="block text-sm font-medium text-slate">
              Canal de contacto
            </label>
            <select
              id="channel" name="channel" defaultValue="manual"
              className="w-full rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="manual">Presencial (local)</option>
              <option value="call">Llamada telefónica</option>
              <option value="whatsapp">WhatsApp (manual)</option>
              <option value="webform">Formulario web</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notes" className="block text-sm font-medium text-slate">
              ¿Qué consulta? <span className="text-red-500">*</span>
            </label>
            <textarea
              id="notes" name="notes" required rows={4}
              placeholder="Ej. Interesada en botox de frente y relleno de labios. Preguntó por precios y disponibilidad para este mes."
              className="w-full rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
                         focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate resize-none"
            />
            <p className="text-xs text-slate">
              El copiloto procesará esta nota automáticamente y generará una tarea si es necesario.
            </p>
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100">
              {state.error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit" disabled={pending}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                         shadow-xs hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed
                         transition-colors"
            >
              {pending ? 'Guardando...' : 'Registrar lead'}
            </button>
            <Link
              href="/leads"
              className="rounded-lg border border-fog px-4 py-2.5 text-sm font-medium text-slate
                         hover:bg-mist transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
