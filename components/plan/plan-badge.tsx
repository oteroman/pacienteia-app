import type { Plan } from '@/lib/plans/config'

const PLAN_STYLES: Record<Plan, { label: string; className: string }> = {
  trial:   { label: 'Trial',   className: 'bg-gray-100 text-gray-600 border-gray-200' },
  basic:   { label: 'Básico',  className: 'bg-gray-100 text-gray-700 border-gray-200' },
  pro:     { label: 'Pro',     className: 'bg-brand-50 text-brand-700 border-brand-200' },
  premium: { label: 'Premium', className: 'bg-purple-50 text-purple-700 border-purple-200' },
}

interface PlanBadgeProps {
  plan: Plan
  size?: 'sm' | 'md' | 'lg'
}

export function PlanBadge({ plan, size = 'md' }: PlanBadgeProps) {
  const { label, className } = PLAN_STYLES[plan]
  const sizeClass = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : size === 'lg'
    ? 'text-sm px-3 py-1 font-semibold'
    : 'text-xs px-2.5 py-0.5 font-medium'

  return (
    <span className={`inline-flex items-center rounded-full border ${className} ${sizeClass}`}>
      {label}
    </span>
  )
}
