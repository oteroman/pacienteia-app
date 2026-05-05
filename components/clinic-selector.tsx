'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/providers/clinic-provider'
import { setActiveClinicCookie } from '@/app/actions/clinic'

export function ClinicSelector() {
  const { clinic, allClinics } = useClinic()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on outside click
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
      <span className="text-sm font-medium text-gray-700 hidden sm:block">
        {clinic.name}
      </span>
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
        className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-brand-600 transition-colors"
      >
        {clinic.name}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-60 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
          {allClinics.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-brand-50 transition-colors
                          ${c.id === clinic.id ? 'text-brand-700 font-semibold bg-brand-50' : 'text-gray-700'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
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
