'use client'

import { useActionState, useRef, useEffect } from 'react'
import { saveAppointmentNotes } from '@/app/actions/appointments'

interface Props {
  appointmentId: string
  initialNotes: string | null
}

export default function AppointmentNotesEditor({ appointmentId, initialNotes }: Props) {
  const saveWithId = saveAppointmentNotes.bind(null, appointmentId)
  const [state, action, isPending] = useActionState(saveWithId, null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-gray-400">Notas de la cita</p>
        {state?.ok && (
          <span className="text-xs text-green-600 font-medium">Guardado</span>
        )}
        {state?.error && (
          <span className="text-xs text-red-500">{state.error}</span>
        )}
      </div>
      <form action={action} className="space-y-2">
        <textarea
          ref={textareaRef}
          name="notes"
          defaultValue={initialNotes ?? ''}
          onInput={handleInput}
          rows={3}
          placeholder="Agrega notas sobre el tratamiento, observaciones post-cita, indicaciones dadas al paciente..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none leading-relaxed"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="text-sm font-medium bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {isPending ? 'Guardando...' : 'Guardar notas'}
          </button>
        </div>
      </form>
    </div>
  )
}
