'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePlanStatus } from '@/context/plan-status'
import { LinkButton } from '@/components/ui/button'
import { UpgradeModal } from './upgrade-modal'
import { trackGatingEvent } from '@/app/actions/analytics'
import type { GatedResource, GatedOperation } from './route-gate'
import type { ReactNode } from 'react'

interface GatedActionButtonProps {
  href: string
  resource: GatedResource
  operation?: GatedOperation
  size?: 'sm' | 'md'
  children: ReactNode
}

function shouldBlock(gate: string, operation: GatedOperation): boolean {
  if (gate === 'allowed') return false
  if (gate === 'hard_blocked') return true
  return operation === 'create'
}

// Match LinkButton's size classes exactly to avoid layout shift
const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
}

export function GatedActionButton({
  href,
  resource,
  operation = 'create',
  size = 'md',
  children,
}: GatedActionButtonProps) {
  const { usage } = usePlanStatus()
  const gate = usage[resource].result
  const blocked = shouldBlock(gate, operation)
  const [showModal, setShowModal] = useState(false)
  const pathname = usePathname()

  // allowed — plain link, no interception
  if (!blocked) {
    return <LinkButton href={href} size={size}>{children}</LinkButton>
  }

  const isSoft = gate === 'soft_blocked'
  const base = `inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors ${SIZE_CLASSES[size]}`

  function handleClick() {
    void trackGatingEvent({
      event:       'blocked_action_attempted',
      resource,
      gate_state:  gate as 'soft_blocked' | 'hard_blocked',
      operation,
      source_page: pathname,
    })
    setShowModal(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={isSoft ? 'Cerca del límite — actualiza tu plan' : 'Límite alcanzado — solo lectura'}
        className={
          isSoft
            ? `${base} bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 cursor-pointer`
            : `${base} bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed`
        }
      >
        <span aria-hidden="true">{isSoft ? '⚠️' : '🔒'}</span>
        <span>{children}</span>
      </button>

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
