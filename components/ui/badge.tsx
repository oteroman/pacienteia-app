import type { ReactNode } from 'react'

type Variant = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'brand'

const variants: Record<Variant, string> = {
  gray:   'bg-[#F3F6F9] text-slate',
  green:  'bg-lima-100 text-lima-700',
  red:    'bg-red-100 text-red-600',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-ai-100 text-ai-600',
  brand:  'bg-brand-100 text-brand-700',
}

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
