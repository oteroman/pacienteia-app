'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/providers/clinic-provider'
import { setActiveClinicCookie } from '@/app/actions/clinic'

const ROLE_LABEL: Record<string, string> = {
  owner:   'Propietario',
  admin:   'Admin',
  staff:   'Staff',
  viewer:  'Viewer',
}

const ROLE_COLOR: Record<string, string> = {
  owner:  'text-violet-600 bg-violet-50',
  admin:  'text-blue-600 bg-blue-50',
  staff:  'text-slate bg-[#F3F6F9]',
  viewer: 'text-slate bg-mist',
}

export function ClinicSelector() {
  const { clinic, allClinics } = useClinic()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (allClinics.length <= 1) {
    return (
      <div className="hidden sm:flex items-center gap-2">
        <BuildingIcon />
        <span className="text-sm font-medium text-ink">{clinic.name}</span>
        {clinic.role && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLOR[clinic.role] ?? ROLE_COLOR.staff}`}>
            {ROLE_LABEL[clinic.role] ?? clinic.role}
          </span>
        )}
      </div>
    )
  }

  async function handleSelect(clinicId: string) {
    setOpen(false)
    await setActiveClinicCookie(clinicId)
    router.refresh()
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
          open
            ? 'bg-[#F3F6F9] border-fog text-ink'
            : 'bg-white border-fog text-slate hover:bg-mist hover:text-ink'
        }`}
      >
        <BuildingIcon />
        <span className="max-w-[140px] truncate">{clinic.name}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-fog rounded-xl shadow-lg ring-1 ring-black/5 z-50 overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-semibold text-slate uppercase tracking-wider border-b border-fog">
            Mis clínicas
          </p>
          <div className="py-1">
            {allClinics.map((c) => {
              const isActive = c.id === clinic.id
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors group ${
                    isActive ? 'bg-violet-50' : 'hover:bg-mist'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                    isActive ? 'bg-violet-600 text-white' : 'bg-[#F3F6F9] text-slate group-hover:bg-fog'
                  }`}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-violet-700' : 'text-ink'}`}>
                      {c.name}
                    </p>
                    {c.role && (
                      <p className={`text-[10px] font-semibold ${isActive ? 'text-violet-500' : 'text-slate'}`}>
                        {ROLE_LABEL[c.role] ?? c.role}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <CheckIcon className="w-4 h-4 text-violet-600 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function BuildingIcon() {
  return (
    <svg className="w-4 h-4 text-slate shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-slate transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}
