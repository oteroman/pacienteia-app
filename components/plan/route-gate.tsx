'use client'

import { useState } from 'react'
import { usePlanStatus } from '@/context/plan-status'
import { UpgradeModal } from './upgrade-modal'
import type { GateResult } from '@/lib/plans/gating'

export type GatedResource = 'leads' | 'appointments' | 'users'
export type GatedOperation = 'create' | 'edit'

interface RouteGateProps {
  resource: GatedResource
  /** create: blocked for soft + hard  |  edit: blocked for hard only */
  operation?: GatedOperation
  children: React.ReactNode
}

function shouldBlock(gate: GateResult, operation: GatedOperation): boolean {
  if (gate === 'allowed') return false
  if (gate === 'hard_blocked') return true
  return operation === 'create'
}

/**
 * Generic gate wrapper for arbitrary content (tables, inline actions, etc.).
 * For link buttons, prefer GatedActionButton — it renders richer visual states.
 */
export function RouteGate({ resource, operation = 'create', children }: RouteGateProps) {
  const { usage } = usePlanStatus()
  const gate = usage[resource].result
  const blocked = shouldBlock(gate, operation)
  const [showModal, setShowModal] = useState(false)

  if (!blocked) return <>{children}</>

  return (
    <>
      {/* Outer div captures clicks; inner suppresses pointer events on children */}
      <div
        onClick={() => setShowModal(true)}
        onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
        className="inline-block cursor-not-allowed"
        role="button"
        tabIndex={0}
        aria-label="Acción bloqueada — actualiza tu plan"
      >
        <div className="pointer-events-none opacity-50 select-none">
          {children}
        </div>
      </div>

      {showModal && (
        <UpgradeModal
          resource={resource}
          gate={gate as 'soft_blocked' | 'hard_blocked'}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
