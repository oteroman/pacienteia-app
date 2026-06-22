'use client'

import { useState, useTransition } from 'react'
import { notifyOpportunityViaWA }  from '@/app/actions/opportunities'

interface Props {
  patientId:     string
  patientName:   string
  phone:         string
  treatmentType: string
}

export function NotifyWAButton({ patientId, patientName, phone, treatmentType }: Props) {
  const [sent, setSent]           = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      setError(null)
      const result = await notifyOpportunityViaWA(patientId, patientName, phone, treatmentType)
      if (result.ok) {
        setSent(true)
      } else {
        setError(result.error ?? 'Error')
      }
    })
  }

  if (sent) {
    return (
      <span className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-lima-700 bg-lima-50 border border-lima-200 py-2 rounded-xl">
        ✓ Enviado
      </span>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full text-xs font-semibold py-2 rounded-xl border border-fog text-slate
                   hover:bg-mist disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
      >
        {isPending
          ? <span className="inline-block w-3 h-3 border border-slate border-t-transparent rounded-full animate-spin" />
          : '💬'
        }
        {isPending ? 'Enviando…' : 'Notificar WA'}
      </button>
      {error && <p className="text-[10px] text-red-500 text-center">{error}</p>}
    </div>
  )
}
