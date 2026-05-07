'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { OnboardingProgress } from '@/lib/plans/onboarding'

const SKIP_KEY = 'pacienteia_onboarding_skipped'

export function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SKIP_KEY)) setSkipped(true)
  }, [])

  // Auto-hide when all done or skipped
  if (progress.allDone || skipped) return null

  function handleSkip() {
    sessionStorage.setItem(SKIP_KEY, '1')
    setSkipped(true)
  }

  const pct = Math.round((progress.completed / progress.total) * 100)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Configura tu clínica</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {progress.completed} de {progress.total} pasos completados
          </p>
        </div>
        <button
          onClick={handleSkip}
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
        >
          Saltar por ahora
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <ul className="space-y-3">
        {progress.steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-3">
            {/* Step indicator */}
            <span
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step.done
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step.done ? '✓' : i + 1}
            </span>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              )}
            </div>

            {/* CTA link (only for incomplete steps) */}
            {!step.done && (
              <Link
                href={step.href}
                className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors whitespace-nowrap"
              >
                Ir →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
