'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { submitInteraction, type InteractionFormState } from '@/app/actions/copilot'
import type { SourceType } from '@/lib/copilot/index'
import { SOURCE_LABELS }   from '@/lib/copilot/index'

const SOURCE_TYPES: SourceType[] = ['whatsapp_text', 'whatsapp_audio', 'phone_call', 'staff_note', 'chat']

interface Props {
  patients: { id: string; full_name: string }[]
}

export default function NewInteractionForm({ patients }: Props) {
  const [state, action, isPending] = useActionState<InteractionFormState, FormData>(
    submitInteraction,
    null
  )

  return (
    <form action={action} className="space-y-5">

      {state?.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Source type */}
      <div>
        <label className="block text-sm font-medium text-slate mb-2">
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
                border-fog text-slate hover:border-fog transition-colors">
                {SOURCE_LABELS[type]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Patient (optional) */}
      <div>
        <label htmlFor="patient_id" className="block text-sm font-medium text-slate mb-1">
          Paciente <span className="text-slate font-normal">(opcional)</span>
        </label>
        <select
          id="patient_id"
          name="patient_id"
          className="w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="">— Sin paciente específico —</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      </div>

      {/* Raw content */}
      <div>
        <label htmlFor="raw_content" className="block text-sm font-medium text-slate mb-1">
          Contenido
        </label>
        <textarea
          id="raw_content"
          name="raw_content"
          rows={8}
          required
          minLength={5}
          placeholder="Pega aquí el mensaje de WhatsApp, transcripción de llamada o nota del staff..."
          className="w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
        />
        <p className="text-xs text-slate mt-1">
          El copiloto analizará el texto y extraerá compromisos, riesgos y tareas automáticamente.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Analizando...' : 'Analizar y guardar'}
        </button>
        <Link
          href="/copilot"
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate bg-[#F3F6F9] hover:bg-fog transition-colors"
        >
          Cancelar
        </Link>
      </div>

    </form>
  )
}
