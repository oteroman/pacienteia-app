'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePlanStatus } from '@/context/plan-status'
import type { GateResult } from '@/lib/plans/gating'

type GatedResource = 'leads' | 'appointments' | 'users'
type GatedOperation = 'create' | 'edit'

interface RouteGateProps {
  resource: GatedResource
  /** create: blocked for soft + hard  |  edit: blocked for hard only */
  operation?: GatedOperation
  children: React.ReactNode
}

function shouldBlock(gate: GateResult, operation: GatedOperation): boolean {
  if (gate === 'allowed') return false
  if (gate === 'hard_blocked') return true
  // soft_blocked only blocks creation, not editing existing records
  return operation === 'create'
}

export function RouteGate({ resource, operation = 'create', children }: RouteGateProps) {
  const { usage } = usePlanStatus()
  const gate = usage[resource].result
  const blocked = shouldBlock(gate, operation)
  const [showModal, setShowModal] = useState(false)

  if (!blocked) return <>{children}</>

  return (
    <>
      {/* Wrapper captures clicks; inner div suppresses pointer events on children */}
      <div
        onClick={() => setShowModal(true)}
        className="inline-block cursor-not-allowed"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
        aria-label="Acción bloqueada — actualiza tu plan"
      >
        <div className="pointer-events-none opacity-50 select-none">
          {children}
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-bold text-gray-900">
              {gate === 'soft_blocked'
                ? '⚠️ Alcanzaste el 80% de tu límite'
                : '🚫 Límite alcanzado'}
            </p>
            <p className="text-sm text-gray-600">
              {gate === 'soft_blocked'
                ? 'Estás cerca del límite de tu plan. Actualiza para seguir creando sin interrupciones.'
                : 'Alcanzaste el límite de tu plan actual. Actualiza para continuar.'}
            </p>
            <div className="flex gap-3">
              <Link
                href="/pricing"
                className="flex-1 text-center bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                Ver planes
              </Link>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 text-sm text-gray-600 border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
