'use client'

import { useTransition } from 'react'
import { useRouter }     from 'next/navigation'
import { updateAppointmentStatus } from '@/app/actions/appointments'

// Quick "No asistió" action for the day's agenda — marks an appointment as
// no-show in ≤2 clicks (with a confirm to avoid accidental status changes).
export function NoShowButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation()
        if (!confirm('¿Marcar esta cita como "No asistió"?')) return
        startTransition(async () => {
          await updateAppointmentStatus(id, 'no_show')
          router.refresh()
        })
      }}
      title="Marcar como no asistió"
      className="text-xs font-medium text-slate hover:text-red-600 border border-fog hover:border-red-200 px-2 py-1 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {pending ? '…' : 'No asistió'}
    </button>
  )
}
