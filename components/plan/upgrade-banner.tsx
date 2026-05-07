'use client'

import Link from 'next/link'
import type { Plan } from '@/lib/plans/config'
import { PLAN_ORDER } from '@/lib/plans/config'

interface UpgradeBannerProps {
  variant: 'trial' | 'soft' | 'hard'
  currentPlan: Plan
  daysLeft?: number        // for trial variant
  resource?: string        // for soft/hard: "leads", "citas", etc.
}

function nextPlan(current: Plan): Plan {
  const idx = PLAN_ORDER.indexOf(current)
  return PLAN_ORDER[Math.min(idx + 1, PLAN_ORDER.length - 1)] as Plan
}

const PLAN_NAMES: Record<Plan, string> = {
  trial: 'Trial', basic: 'Básico', pro: 'Pro', premium: 'Premium',
}

export function UpgradeBanner({ variant, currentPlan, daysLeft, resource }: UpgradeBannerProps) {
  if (variant === 'trial') {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-yellow-800">
          <span className="text-base">⏳</span>
          <span>
            <strong>Tu trial vence en {daysLeft ?? 0} día{daysLeft !== 1 ? 's' : ''}.</strong>
            {' '}Elige un plan para no perder tu configuración y datos.
          </span>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 text-xs font-semibold text-yellow-900 bg-yellow-200 hover:bg-yellow-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Ver planes
        </Link>
      </div>
    )
  }

  if (variant === 'soft') {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-orange-800">
          <span className="text-base">📊</span>
          <span>
            <strong>Casi en el límite{resource ? ` de ${resource}` : ''}.</strong>
            {' '}Sube a {PLAN_NAMES[nextPlan(currentPlan)]} para seguir creciendo sin interrupciones.
          </span>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 text-xs font-semibold text-orange-900 bg-orange-200 hover:bg-orange-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Subir plan
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-red-800">
        <span className="text-base">🚫</span>
        <span>
          <strong>Límite alcanzado{resource ? ` de ${resource}` : ''}.</strong>
          {' '}Tu plan {PLAN_NAMES[currentPlan]} no permite crear más. Sube de plan para continuar.
        </span>
      </div>
      <Link
        href="/pricing"
        className="shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
      >
        Subir ahora
      </Link>
    </div>
  )
}
