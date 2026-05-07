'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePlanStatus, useGateLevel } from '@/context/plan-status'

const DISMISS_KEY = 'pacienteia_trial_banner_dismissed'

export function GatingBanner() {
  const { sub, trialDaysLeft } = usePlanStatus()
  const gateLevel = useGateLevel()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) setDismissed(true)
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  // Hard block (usage at 100%, account not cancelled)
  if (gateLevel === 'hard_blocked' && sub.status !== 'cancelled') {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <p className="text-sm text-red-800">
          <strong>Límite alcanzado</strong> · Nuevas acciones deshabilitadas hasta que actualices tu plan.
        </p>
        <Link
          href="/pricing"
          className="shrink-0 text-xs font-semibold text-red-900 underline hover:no-underline whitespace-nowrap"
        >
          Actualizar ahora →
        </Link>
      </div>
    )
  }

  // Soft block (usage > 80%)
  if (gateLevel === 'soft_blocked') {
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <p className="text-sm text-orange-800">
          <strong>Atención</strong> · Alcanzaste el 80% de tu límite de recursos este mes.
        </p>
        <Link
          href="/pricing"
          className="shrink-0 text-xs font-semibold text-orange-900 underline hover:no-underline whitespace-nowrap"
        >
          Actualizar plan →
        </Link>
      </div>
    )
  }

  // Overdue (payment pending, within grace period)
  if (sub.status === 'overdue') {
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <p className="text-sm text-orange-800">
          <strong>Pago pendiente</strong> · Tu acceso continúa durante el período de gracia.
        </p>
        <a
          href="mailto:billing@pacienteia.com?subject=Regularizar%20pago%20PacienteIA"
          className="shrink-0 text-xs font-semibold text-orange-900 underline hover:no-underline whitespace-nowrap"
        >
          Regularizar →
        </a>
      </div>
    )
  }

  // Trial banner — dismissible per session
  if (sub.status === 'trialing' && !dismissed) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <p className="text-sm text-yellow-800">
          ⏳ Trial gratuito ·{' '}
          <strong>{trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restantes</strong>{' '}
          antes de elegir tu plan
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/pricing"
            className="text-xs font-semibold text-yellow-900 underline hover:no-underline whitespace-nowrap"
          >
            Ver planes →
          </Link>
          <button
            onClick={dismiss}
            aria-label="Cerrar banner"
            className="text-yellow-600 hover:text-yellow-800 text-xl leading-none font-light"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return null
}
