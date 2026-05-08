import { createAdminClient } from '@/lib/supabase/admin'
import type { ClinicValue } from './value'

// ── Signal types ──────────────────────────────────────────────
export type SignalType =
  | 'upgrade_ready'           // score ≥ 70 + ROI ≥ 1.5x → auto-task
  | 'expansion_opportunity'   // ROI ≥ 2x on pro plan → pitch premium
  | 'high_value_low_plan'     // ROI ≥ 2x on basic/trial → pitch pro
  | 'low_value_high_plan'     // pro/premium but score < 40 → activation needed
  | 'renewal_risk_mild'       // score 20-34 or ROI 0.3x-0.69x → check-in
  | 'renewal_risk_severe'     // score < 20 or ROI < 0.3x → urgent → auto-task

export const EXPANSION_SIGNALS: SignalType[] = [
  'upgrade_ready', 'expansion_opportunity', 'high_value_low_plan',
]
export const RENEWAL_RISK_SIGNALS: SignalType[] = [
  'renewal_risk_mild', 'renewal_risk_severe', 'low_value_high_plan',
]
// Only these two generate automatic clinic_tasks entries
const AUTO_TASK_TYPES: SignalType[] = ['upgrade_ready', 'renewal_risk_severe']

// ── Signal playbook definitions ───────────────────────────────
export interface SignalPlaybook {
  priority:    'critical' | 'high' | 'medium'
  label:       string   // short label for badges / table
  trigger:     string   // machine-readable condition description
  action:      string   // recommended action for CS
  owner:       'sales' | 'cs'
  sla:         string
  messageTemplate: string
}

export const SIGNAL_PLAYBOOKS: Record<SignalType, SignalPlaybook> = {
  upgrade_ready: {
    priority: 'high',
    label: 'Upgrade listo',
    trigger: 'Value score ≥ 70 y ROI ≥ 1.5× el costo del plan actual.',
    action: 'Llamada de expansión en 48h. Presentar beneficios del plan superior con comparativa de ROI.',
    owner: 'sales',
    sla: '48h',
    messageTemplate: 'Hola [nombre], están sacando un ROI excelente de PacienteIA. El siguiente plan les daría más capacidad para seguir creciendo sin límites. ¿Agendamos 15 min esta semana?',
  },
  expansion_opportunity: {
    priority: 'medium',
    label: 'Expansión',
    trigger: 'ROI ≥ 2× plan actual (plan Pro). Candidato a Premium.',
    action: 'Enviar propuesta de upgrade a Premium con comparativa de ROI potencial.',
    owner: 'sales',
    sla: '72h',
    messageTemplate: 'Hola [nombre], ya están recuperando [roi]x el valor de su plan este mes. El plan Premium les daría capacidad ilimitada para escalar aún más.',
  },
  high_value_low_plan: {
    priority: 'high',
    label: 'Alto valor / plan bajo',
    trigger: 'ROI ≥ 2× plan actual (Básico o Trial). Candidato inmediato a Pro.',
    action: 'Propuesta urgente de upgrade a Pro con argumento de ROI directo.',
    owner: 'sales',
    sla: '48h',
    messageTemplate: 'Hola [nombre], ya recuperaron S/ [roi] este mes con el plan Básico. El plan Pro les permitiría escalar eso significativamente.',
  },
  low_value_high_plan: {
    priority: 'high',
    label: 'Bajo valor / plan alto',
    trigger: 'Plan Pro o Premium pero value score < 40. Riesgo de downgrade o cancelación.',
    action: 'Sesión de activación urgente. Revisar onboarding y configuración de flujos.',
    owner: 'cs',
    sla: '48h',
    messageTemplate: 'Hola [nombre], vemos que hay mucho potencial sin usar en su plan. ¿Les ayudamos a configurar las funcionalidades que más impacto generan?',
  },
  renewal_risk_mild: {
    priority: 'medium',
    label: 'Riesgo renovación',
    trigger: 'Value score 20-34 o ROI entre 0.3×-0.69× el plan. Tendencia débil.',
    action: 'Check-in proactivo. Identificar bloqueos o uso bajo. Ofrecer sesión de soporte.',
    owner: 'cs',
    sla: '72h',
    messageTemplate: 'Hola [nombre], queremos asegurarnos de que están aprovechando PacienteIA al máximo. ¿Tienes 10 minutos para un check-in rápido?',
  },
  renewal_risk_severe: {
    priority: 'critical',
    label: 'Riesgo alto cancelación',
    trigger: 'Value score < 20 o ROI < 0.3× el plan activo. Riesgo elevado de churn.',
    action: 'Llamada urgente de retención. Evaluar descuento temporal o ajuste de plan.',
    owner: 'cs',
    sla: '24h',
    messageTemplate: 'Hola [nombre], notamos que el uso de PacienteIA ha sido bajo. Queremos ayudarles a encontrar la configuración ideal para su clínica. ¿Podemos hablar esta semana?',
  },
}

// ── Signal derivation ─────────────────────────────────────────
export interface Signal extends SignalPlaybook {
  type: SignalType
}

export function deriveSignals(value: ClinicValue): Signal[] {
  const signals: Signal[] = []
  const { valueScore, roi, plan } = value

  // Upgrade ready: strong value + good ROI + room to grow
  if (valueScore.total >= 70 && roi.multiplier >= 1.5 && plan !== 'premium') {
    signals.push({ type: 'upgrade_ready', ...SIGNAL_PLAYBOOKS.upgrade_ready })
  }

  // High value on low plan (basic/trial)
  if (roi.multiplier >= 2 && (plan === 'basic' || plan === 'trial')) {
    signals.push({ type: 'high_value_low_plan', ...SIGNAL_PLAYBOOKS.high_value_low_plan })
  }

  // Expansion opportunity on pro plan → upgrade to premium
  if (roi.multiplier >= 2 && plan === 'pro') {
    signals.push({ type: 'expansion_opportunity', ...SIGNAL_PLAYBOOKS.expansion_opportunity })
  }

  // Low value on premium/pro → activation risk
  if ((plan === 'pro' || plan === 'premium') && valueScore.total < 40) {
    signals.push({ type: 'low_value_high_plan', ...SIGNAL_PLAYBOOKS.low_value_high_plan })
  }

  // Renewal risk — exclude trials (low ROI expected during testing)
  if (plan !== 'trial' && roi.planCost > 0) {
    if (valueScore.total < 20 || roi.multiplier < 0.3) {
      signals.push({ type: 'renewal_risk_severe', ...SIGNAL_PLAYBOOKS.renewal_risk_severe })
    } else if (valueScore.total < 35 || roi.multiplier < 0.7) {
      // mild only if not already severe
      const alreadySevere = signals.some((s) => s.type === 'renewal_risk_severe')
      if (!alreadySevere) {
        signals.push({ type: 'renewal_risk_mild', ...SIGNAL_PLAYBOOKS.renewal_risk_mild })
      }
    }
  }

  return signals
}

export function isExpansionSignal(type: SignalType): boolean {
  return EXPANSION_SIGNALS.includes(type)
}

export function isRenewalRiskSignal(type: SignalType): boolean {
  return RENEWAL_RISK_SIGNALS.includes(type)
}

// ── Auto-task sync for value signals ─────────────────────────
// Only upgrade_ready and renewal_risk_severe generate tasks automatically.
// Other signals are visual-only in the admin dashboard.
export async function syncValueSignalTasks(
  clinics: ClinicValue[],
): Promise<{ inserted: number }> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch existing open tasks for auto-task trigger types to avoid duplicates
  const { data: existingRaw } = await sb
    .from('clinic_tasks')
    .select('organization_id, trigger_type')
    .eq('status', 'open')
    .in('trigger_type', ['upgrade_ready_value', 'renewal_risk_severe'])

  const existing = new Set<string>(
    ((existingRaw ?? []) as { organization_id: string; trigger_type: string }[])
      .map((r) => `${r.organization_id}:${r.trigger_type}`)
  )

  const toInsert: object[] = []

  for (const clinic of clinics) {
    const signals = deriveSignals(clinic).filter((s) => AUTO_TASK_TYPES.includes(s.type))

    for (const signal of signals) {
      // upgrade_ready uses 'upgrade_ready_value' to avoid collision with health-based tasks
      const triggerType = signal.type === 'upgrade_ready' ? 'upgrade_ready_value' : signal.type
      const key = `${clinic.clinicId}:${triggerType}`
      if (existing.has(key)) continue

      const pb = SIGNAL_PLAYBOOKS[signal.type]
      toInsert.push({
        organization_id:  clinic.clinicId,
        trigger_type:     triggerType,
        status:           'open',
        priority:         pb.priority === 'critical' ? 'high' : pb.priority,
        title:            pb.label,
        description:      pb.trigger,
        action_text:      pb.action,
        message_template: pb.messageTemplate,
        health_score:     clinic.valueScore.total,
      })
    }
  }

  if (toInsert.length > 0) {
    await sb.from('clinic_tasks').insert(toInsert)
  }

  return { inserted: toInsert.length }
}
