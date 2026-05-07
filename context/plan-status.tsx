'use client'

import { createContext, useContext } from 'react'
import type { ClinicPlanStatus, GateResult } from '@/lib/plans/gating'

const PlanStatusContext = createContext<ClinicPlanStatus | null>(null)

export function PlanStatusProvider({
  value,
  children,
}: {
  value: ClinicPlanStatus
  children: React.ReactNode
}) {
  return (
    <PlanStatusContext.Provider value={value}>
      {children}
    </PlanStatusContext.Provider>
  )
}

export function usePlanStatus(): ClinicPlanStatus {
  const ctx = useContext(PlanStatusContext)
  if (!ctx) throw new Error('usePlanStatus must be inside PlanStatusProvider')
  return ctx
}

/** Returns the worst gate level across all tracked resources. */
export function useGateLevel(): GateResult {
  const { usage } = usePlanStatus()
  const results = Object.values(usage).map((g) => g.result)
  if (results.includes('hard_blocked')) return 'hard_blocked'
  if (results.includes('soft_blocked')) return 'soft_blocked'
  return 'allowed'
}
