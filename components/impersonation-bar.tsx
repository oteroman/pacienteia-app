'use client'

import { exitTenant } from '@/app/actions/platform'

interface ImpersonationBarProps {
  clinicName: string
}

export function ImpersonationBar({ clinicName }: ImpersonationBarProps) {
  return (
    <div className="bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-between sticky top-0 z-50">
      <span>
        Modo soporte | Clínica: <strong>{clinicName}</strong>
      </span>
      <form action={exitTenant}>
        <button
          type="submit"
          className="bg-white text-amber-700 px-3 py-0.5 rounded font-semibold text-xs hover:bg-amber-50 transition-colors"
        >
          Salir del modo soporte
        </button>
      </form>
    </div>
  )
}
