import Link from 'next/link'
import type { PlanFeature } from '@/lib/plans/config'

const FEATURE_LABELS: Partial<Record<PlanFeature, string>> = {
  reactivation:            'Reactivación Pro',
  reputation_shield:       'Escudo de Reputación',
  advanced_confirmation:   'Confirmación avanzada WhatsApp',
  lead_triage_ai:          'Lead Triage con IA',
  roi_dashboard:           'Dashboard ROI',
  api_webhooks:            'API y webhooks externos',
  post_treatment_followup: 'Seguimiento post-tratamiento',
  web_forms:               'Web forms integrados',
  csv_export:              'Exportación CSV',
}

interface PlanAccessNoticeProps {
  feature: PlanFeature
  currentPlan: string
}

export function PlanAccessNotice({ feature, currentPlan }: PlanAccessNoticeProps) {
  const label = FEATURE_LABELS[feature] ?? feature
  return (
    <div className="rounded-2xl border border-fog bg-mist p-8 text-center space-y-3">
      <p className="text-3xl">🔒</p>
      <p className="text-sm font-semibold text-ink">
        {label} no está incluido en el plan {currentPlan}
      </p>
      <p className="text-xs text-slate">
        Actualiza tu plan para activar esta funcionalidad y empezar a usarla de inmediato.
      </p>
      <Link
        href="/pricing"
        className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        Ver planes y precios
      </Link>
    </div>
  )
}
