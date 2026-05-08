'use client'

import { createContext, useContext } from 'react'

export interface ActiveClinic {
  id: string
  name: string
  slug: string
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  industry: string | null
  role: string
  [key: string]: unknown
}

interface ClinicContextValue {
  clinic: ActiveClinic
  allClinics: ActiveClinic[]
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

export function ClinicProvider({
  clinic,
  allClinics,
  children,
}: {
  clinic: ActiveClinic
  allClinics: ActiveClinic[]
  children: React.ReactNode
}) {
  return (
    <ClinicContext.Provider value={{ clinic, allClinics }}>
      {children}
    </ClinicContext.Provider>
  )
}

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used inside ClinicProvider')
  return ctx
}
