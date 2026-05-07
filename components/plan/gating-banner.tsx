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

  // Hard block — growth framing, premium CTA
  if (gateLevel === 'hard_blocked' && sub.status !== 'cancelled') {
    return (
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg shrink-0" aria-hidden>🚀</span>
          <p className="text-sm text-white/90 truncate">
            <strong className="text-white">Tu clínica está creciendo.</strong>{' '}
            <span className="hidden sm:inline">Alcanzaste el límite de tu plan actual — pasa al siguiente nivel para seguir sin interrupciones.</span>
            <span className="sm:hidden">Actualiza tu plan para seguir.</span>
          </p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 bg-white text-violet-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors whitespace-nowrap"
        >
          Mejorar plan →
        </Link>
      </div>
    )
  }

  // Soft block — positive milestone framing
  if (gateLevel === 'soft_blocked') {
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg shrink-0" aria-hidden>📈</span>
          <p className="text-sm text-white/90 truncate">
            <strong className="text-white">¡Vas muy bien!</strong>{' '}
            <span className="hidden sm:inline">Usaste el 80% de tu plan — considera actualizar antes de que se detenga el flujo.</span>
            <span className="sm:hidden">Ya al 80% de tu plan.</span>
          </p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 bg-white text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
        >
          Ver planes →
        </Link>
      </div>
    )
  }

  // Overdue — professional, informational
  if (sub.status === 'overdue') {
    return (
      <div className="bg-slate-700 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg shrink-0" aria-hidden>💳</span>
          <p className="text-sm text-slate-200 truncate">
            <strong className="text-white">Pago pendiente</strong>{' '}
            <span className="hidden sm:inline">· Tu acceso continúa durante el período de gracia. Regulariza para evitar interrupciones.</span>
          </p>
        </div>
        <a
          href="mailto:billing@pacienteia.com?subject=Regularizar%20pago%20PacienteIA"
          className="shrink-0 bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
        >
          Regularizar →
        </a>
      </div>
    )
  }

  // Trialing — warm, friendly countdown
  if (sub.status === 'trialing' && !dismissed) {
    const urgent = trialDaysLeft !== null && trialDaysLeft <= 3
    return (
      <div className={`px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 ${
        urgent
          ? 'bg-gradient-to-r from-rose-500 to-pink-500'
          : 'bg-gradient-to-r from-indigo-500 to-violet-500'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg shrink-0" aria-hidden>{urgent ? '⏳' : '✨'}</span>
          <p className="text-sm text-white/90 truncate">
            {urgent ? (
              <>
                <strong className="text-white">
                  {trialDaysLeft === 0 ? 'Hoy termina tu trial' : `${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} para elegir tu plan`}
                </strong>
                {' '}<span className="hidden sm:inline">— activa tu plan y sigue aprovechando PacienteIA sin pausas.</span>
              </>
            ) : (
              <>
                <strong className="text-white">
                  {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} de prueba gratuita restantes
                </strong>
                {' '}<span className="hidden sm:inline">— estás probando todas las funciones sin costo.</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/pricing"
            className="bg-white text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            {urgent ? 'Activar plan →' : 'Ver planes →'}
          </Link>
          {!urgent && (
            <button
              onClick={dismiss}
              aria-label="Cerrar"
              className="text-white/60 hover:text-white transition-colors text-xl leading-none font-light"
            >
              ×
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
