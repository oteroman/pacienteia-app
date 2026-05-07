'use client'

import { RouteGate, type GatedResource, type GatedOperation } from './route-gate'
import { LinkButton } from '@/components/ui/button'
import type { ReactNode } from 'react'

interface GatedActionButtonProps {
  href: string
  resource: GatedResource
  operation?: GatedOperation
  size?: 'sm' | 'md'
  children: ReactNode
}

/**
 * Drop-in replacement for LinkButton when the action should be gated by plan limits.
 * Wraps RouteGate (client) around LinkButton — pages stay Server Components.
 *
 * Usage:
 *   <GatedActionButton href="/leads/new" resource="leads">+ Nuevo lead</GatedActionButton>
 */
export function GatedActionButton({
  href,
  resource,
  operation = 'create',
  size = 'md',
  children,
}: GatedActionButtonProps) {
  return (
    <RouteGate resource={resource} operation={operation}>
      <LinkButton href={href} size={size}>
        {children}
      </LinkButton>
    </RouteGate>
  )
}
