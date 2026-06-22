import type { Plan } from '@/lib/plans/config'

const PLAN_STYLES: Record<Plan, { label: string; className: string }> = {
  trial:   { label: 'Trial',   className: 'bg-[#F3F6F9] text-slate border-fog' },
  basic:   { label: 'Básico',  className: 'bg-[#F3F6F9] text-slate border-fog' },
  pro:     { label: 'Pro',     className: 'bg-brand-50 text-brand-700 border-brand-200' },
  premium: { label: 'Premium', className: 'bg-ai-50 text-ai-600 border-ai-200' },
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
