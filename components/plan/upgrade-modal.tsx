'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackGatingEvent } from '@/app/actions/analytics'
import type { GatedResource } from './route-gate'

interface ModalContent {
  icon: string
  title: string
  subtitle: string
  benefit: string
  primaryCta: string
  primaryHref: string
  secondaryCta: string
  secondaryHref?: string
}

type BlockedGate = 'soft_blocked' | 'hard_blocked'

const COPY: Record<BlockedGate, Record<GatedResource, ModalContent>> = {
  soft_blocked: {
    leads: {
      icon: '⚠️',
      title: '80% del límite de leads',
      subtitle: 'Aún puedes capturar leads, pero estás cerca del tope mensual.',
      benefit: 'Con Pro obtienes 200 leads/mes y nunca pierdes una consulta entrante.',
      primaryCta: 'Subir a Pro',
      primaryHref: '/pricing',
      secondaryCta: 'Ahora no',
    },
    appointments: {
      icon: '⚠️',
      title: '80% del límite de citas',
      subtitle: 'Tu agenda sigue funcionando, pero considera actualizar pronto.',
      benefit: 'Con Pro registras hasta 500 citas al mes sin interrupciones.',
      primaryCta: 'Subir a Pro',
      primaryHref: '/pricing',
      secondaryCta: 'Ahora no',
    },
    users: {
      icon: '⚠️',
      title: '80% del límite de usuarios',
      subtitle: 'Tu equipo está llegando al límite de asientos del plan.',
      benefit: 'Con Pro hasta 3 usuarios. Con Premium, tu equipo completo sin límite.',
      primaryCta: 'Subir a Pro',
      primaryHref: '/pricing',
      secondaryCta: 'Ahora no',
    },
  },
  hard_blocked: {
    leads: {
      icon: '🚫',
      title: 'Límite de leads alcanzado',
      subtitle: 'Tu plan no permite capturar nuevos leads este mes.',
      benefit: 'Con Pro capturas 4× más leads. Ninguna consulta se pierde.',
      primaryCta: 'Actualizar ahora',
      primaryHref: '/pricing',
      secondaryCta: 'Ver mi plan',
      secondaryHref: '/billing',
    },
    appointments: {
      icon: '🚫',
      title: 'Límite de citas alcanzado',
      subtitle: 'No puedes agendar nuevas citas hasta actualizar tu plan.',
      benefit: 'Con Pro: 500 citas/mes. Con Premium: agenda ilimitada para tu clínica.',
      primaryCta: 'Actualizar ahora',
      primaryHref: '/pricing',
      secondaryCta: 'Ver mi plan',
      secondaryHref: '/billing',
    },
    users: {
      icon: '🚫',
      title: 'Límite de usuarios alcanzado',
      subtitle: 'No puedes añadir más miembros al equipo con tu plan actual.',
      benefit: 'Con Pro hasta 3 usuarios. Con Premium: acceso sin restricciones para todos.',
      primaryCta: 'Actualizar ahora',
      primaryHref: '/pricing',
      secondaryCta: 'Ver mi plan',
      secondaryHref: '/billing',
    },
  },
}

interface UpgradeModalProps {
  resource: GatedResource
  gate: BlockedGate
  onClose: () => void
}

export function UpgradeModal({ resource, gate, onClose }: UpgradeModalProps) {
  const copy = COPY[gate][resource]
  const isSoft = gate === 'soft_blocked'
  const pathname = usePathname()

  // Track modal open once on mount
  useEffect(() => {
    void trackGatingEvent({ event: 'modal_opened', resource, gate_state: gate, source_page: pathname })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    void trackGatingEvent({ event: 'modal_closed', resource, gate_state: gate, source_page: pathname })
    onClose()
  }

  function handlePrimary() {
    void trackGatingEvent({ event: 'cta_primary_clicked', resource, gate_state: gate, source_page: pathname })
  }

  function handleSecondary() {
    void trackGatingEvent({ event: 'cta_secondary_clicked', resource, gate_state: gate, source_page: pathname })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{copy.icon}</span>
              <h2 className="text-base font-bold text-gray-900">{copy.title}</h2>
            </div>
            <button
              onClick={handleClose}
              aria-label="Cerrar"
              className="text-gray-300 hover:text-gray-500 text-2xl leading-none flex-shrink-0 -mt-0.5"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{copy.subtitle}</p>
        </div>

        {/* Benefit callout */}
        <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isSoft
            ? 'bg-amber-50 border border-amber-100 text-amber-800'
            : 'bg-brand-50 border border-brand-100 text-brand-800'
        }`}>
          {copy.benefit}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2">
          <Link
            href={copy.primaryHref}
            onClick={handlePrimary}
            className={`w-full text-center font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors ${
              isSoft
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            {copy.primaryCta} →
          </Link>

          {copy.secondaryHref ? (
            <Link
              href={copy.secondaryHref}
              onClick={handleSecondary}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copy.secondaryCta}
            </Link>
          ) : (
            <button
              onClick={handleClose}
              className="w-full text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copy.secondaryCta}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
