'use client'

import { createContext, useContext } from 'react'
import type { Clinic, ClinicRole } from '@/types/database'

export interface ActiveClinic extends Clinic {
  role: ClinicRole
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
