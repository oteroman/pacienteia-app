// ============================================================
// PacienteIA — Plan configuration (source of truth)
// All limits and features are defined here. Never hardcode
// plan logic in components or pages — always read from here.
// ============================================================

export type Plan = 'trial' | 'basic' | 'pro' | 'premium'

export type SubscriptionStatus = 'trialing' | 'active' | 'overdue' | 'cancelled'

export type PlanFeature =
  | 'reputation_shield'        // Post-visit survey + Google review nudge (Basic+)
  | 'advanced_confirmation'    // 3-step WhatsApp sequence (Pro+)
  | 'lead_triage_ai'           // Gemini hot/warm/cold classification (Pro+)
  | 'reactivation'             // Auto-campaign for 90-day inactive patients (Pro+)
  | 'post_treatment_followup'  // Follow-up at 3/7/30 days (Pro+)
  | 'web_forms'                // Embedded lead capture forms (Pro+)
  | 'csv_export'               // Export patients/leads to CSV (Pro+)
  | 'roi_dashboard'            // S/ recovered, citas saved, savings (Premium)
  | 'api_webhooks'             // External API + inbound webhooks (Premium)
  | 'multi_branch'             // Multiple branches / locations (Premium)

export interface PlanLimits {
  name: string
  price_pen: number          // Monthly price in Peruvian Soles
  users: number              // -1 = unlimited
  leads_per_month: number    // -1 = unlimited
  appointments_per_month: number
  n8n_flows: number
  features: readonly PlanFeature[]
}

/** Sentinel value for unlimited resources */
export const UNLIMITED = -1

/** 80% threshold triggers a soft warning before hard block */
export const SOFT_BLOCK_THRESHOLD = 0.8

export const PLAN_CONFIG: Record<Plan, PlanLimits> = {
  trial: {
    name: 'Trial',
    price_pen: 0,
    users: 1,
    leads_per_month: 50,
    appointments_per_month: 150,
    n8n_flows: 1,
    features: ['reputation_shield'],
  },

  basic: {
    name: 'Básico',
    price_pen: 99,
    users: 1,
    leads_per_month: 100,
    appointments_per_month: 300,
    n8n_flows: 2,
    features: ['reputation_shield'],
  },

  pro: {
    name: 'Pro',
    price_pen: 249,
    users: 3,
    leads_per_month: 300,
    appointments_per_month: 800,
    n8n_flows: 5,
    features: [
      'reputation_shield',
      'advanced_confirmation',
      'lead_triage_ai',
      'reactivation',
      'post_treatment_followup',
      'web_forms',
      'csv_export',
    ],
  },

  premium: {
    name: 'Premium',
    price_pen: 499,
    users: UNLIMITED,
    leads_per_month: UNLIMITED,
    appointments_per_month: UNLIMITED,
    n8n_flows: UNLIMITED,
    features: [
      'reputation_shield',
      'advanced_confirmation',
      'lead_triage_ai',
      'reactivation',
      'post_treatment_followup',
      'web_forms',
      'csv_export',
      'roi_dashboard',
      'api_webhooks',
      'multi_branch',
    ],
  },
}

/** Returns true when the limit value means the resource is uncapped */
export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED
}

/** Human-readable label for a limit value */
export function formatLimit(limit: number): string {
  return isUnlimited(limit) ? 'Ilimitado' : String(limit)
}

/** Plans ordered from lowest to highest for upsell UI */
export const PLAN_ORDER: Plan[] = ['trial', 'basic', 'pro', 'premium']

/** Returns true if planA is lower tier than planB */
export function isPlanUpgrade(from: Plan, to: Plan): boolean {
  return PLAN_ORDER.indexOf(to) > PLAN_ORDER.indexOf(from)
}
