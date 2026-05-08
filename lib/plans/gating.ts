// ============================================================
// PacienteIA — Plan Gating
// Use these helpers in Server Actions and Server Components.
// Never expose plan limits logic to the client — always gate
// on the server where clinic_id is trusted.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import {
  PLAN_CONFIG,
  SOFT_BLOCK_THRESHOLD,
  UNLIMITED,
  type Plan,
  type PlanFeature,
  type PlanLimits,
  type SubscriptionStatus,
} from './config'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface ClinicSubscription {
  plan: Plan
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_end: string | null
}

/** allowed = under limit, soft_blocked = 80-99% (show warning), hard_blocked = 100%+ or expired */
export type GateResult = 'allowed' | 'soft_blocked' | 'hard_blocked'

export interface UsageGateResult {
  result: GateResult
  used: number
  limit: number
  pct: number  // 0-100, capped at 100
}

// ─────────────────────────────────────────
// Core subscription fetch (single query, reuse across helpers)
// ─────────────────────────────────────────

export async function getClinicSubscription(organizationId: string): Promise<ClinicSubscription | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('plan, subscription_status, trial_ends_at, current_period_end')
    .eq('id', organizationId)
    .single()

  if (!data) return null

  return {
    plan: (data as any).plan ?? 'trial',
    status: (data as any).subscription_status ?? 'trialing',
    trial_ends_at: (data as any).trial_ends_at ?? null,
    current_period_end: (data as any).current_period_end ?? null,
  }
}

// ─────────────────────────────────────────
// Subscription status helpers
// ─────────────────────────────────────────

export function isTrialExpired(sub: ClinicSubscription): boolean {
  if (sub.status !== 'trialing') return false
  if (!sub.trial_ends_at) return true
  return new Date(sub.trial_ends_at) < new Date()
}

export function isSubscriptionActive(sub: ClinicSubscription): boolean {
  if (sub.status === 'cancelled') return false
  if (isTrialExpired(sub)) return false
  // 'overdue' still gets 7-day grace: still active
  return sub.status === 'trialing' || sub.status === 'active' || sub.status === 'overdue'
}

export function trialDaysRemaining(sub: ClinicSubscription): number {
  if (sub.status !== 'trialing' || !sub.trial_ends_at) return 0
  const ms = new Date(sub.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

// ─────────────────────────────────────────
// Plan limits
// ─────────────────────────────────────────

export async function getPlanLimits(organizationId: string): Promise<PlanLimits> {
  const sub = await getClinicSubscription(organizationId)
  if (!sub || !isSubscriptionActive(sub)) return PLAN_CONFIG.trial
  return PLAN_CONFIG[sub.plan]
}

// ─────────────────────────────────────────
// Feature flag check
// ─────────────────────────────────────────

export async function isFeatureAllowed(organizationId: string, feature: PlanFeature): Promise<boolean> {
  const limits = await getPlanLimits(organizationId)
  return (limits.features as readonly string[]).includes(feature)
}

// ─────────────────────────────────────────
// Usage gate (checks current count vs plan limit)
// ─────────────────────────────────────────

type UsageResource = 'leads' | 'appointments' | 'users'

function getLimitForResource(limits: PlanLimits, resource: UsageResource): number {
  switch (resource) {
    case 'leads':        return limits.leads_per_month
    case 'appointments': return limits.appointments_per_month
    case 'users':        return limits.users
  }
}

export async function checkUsageGate(
  organizationId: string,
  resource: UsageResource,
  currentCount: number
): Promise<UsageGateResult> {
  const sub = await getClinicSubscription(organizationId)

  // Hard block: no subscription or expired
  if (!sub || !isSubscriptionActive(sub)) {
    return { result: 'hard_blocked', used: currentCount, limit: 0, pct: 100 }
  }

  const limits = PLAN_CONFIG[sub.plan]
  const limit = getLimitForResource(limits, resource)

  // Unlimited plan
  if (limit === UNLIMITED) {
    return { result: 'allowed', used: currentCount, limit: UNLIMITED, pct: 0 }
  }

  const pct = Math.min(100, Math.round((currentCount / limit) * 100))

  if (currentCount >= limit) {
    return { result: 'hard_blocked', used: currentCount, limit, pct: 100 }
  }

  if (currentCount >= Math.floor(limit * SOFT_BLOCK_THRESHOLD)) {
    return { result: 'soft_blocked', used: currentCount, limit, pct }
  }

  return { result: 'allowed', used: currentCount, limit, pct }
}

// ─────────────────────────────────────────
// Combined: subscription + all current usage in one call
// Use this in billing page to avoid N+1 queries
// ─────────────────────────────────────────

export interface ClinicPlanStatus {
  sub: ClinicSubscription
  limits: PlanLimits
  usage: {
    leads:        UsageGateResult
    appointments: UsageGateResult
    users:        UsageGateResult
  }
  isActive: boolean
  trialDaysLeft: number
}

/** Pure computation — pass a pre-fetched ClinicSubscription to avoid an extra DB call. */
export function computePlanStatus(
  sub: ClinicSubscription | null,
  currentUsage: { leads: number; appointments: number; users: number }
): ClinicPlanStatus {
  const fallback: ClinicSubscription = {
    plan: 'trial', status: 'trialing', trial_ends_at: null, current_period_end: null,
  }
  const resolved = sub ?? fallback
  const active = isSubscriptionActive(resolved)
  const limits = active ? PLAN_CONFIG[resolved.plan] : PLAN_CONFIG.trial

  function gate(resource: UsageResource, count: number): UsageGateResult {
    if (!active) return { result: 'hard_blocked', used: count, limit: 0, pct: 100 }
    const limit = getLimitForResource(limits, resource)
    if (limit === UNLIMITED) return { result: 'allowed', used: count, limit: UNLIMITED, pct: 0 }
    const pct = Math.min(100, Math.round((count / limit) * 100))
    if (count >= limit) return { result: 'hard_blocked', used: count, limit, pct: 100 }
    if (count >= Math.floor(limit * SOFT_BLOCK_THRESHOLD)) return { result: 'soft_blocked', used: count, limit, pct }
    return { result: 'allowed', used: count, limit, pct }
  }

  return {
    sub: resolved,
    limits,
    usage: {
      leads:        gate('leads',        currentUsage.leads),
      appointments: gate('appointments', currentUsage.appointments),
      users:        gate('users',        currentUsage.users),
    },
    isActive: active,
    trialDaysLeft: trialDaysRemaining(resolved),
  }
}

export async function getClinicPlanStatus(
  organizationId: string,
  currentUsage: { leads: number; appointments: number; users: number }
): Promise<ClinicPlanStatus> {
  const sub = await getClinicSubscription(organizationId)
  const fallback: ClinicSubscription = {
    plan: 'trial',
    status: 'trialing',
    trial_ends_at: null,
    current_period_end: null,
  }
  const resolved = sub ?? fallback
  const active = isSubscriptionActive(resolved)
  const limits = active ? PLAN_CONFIG[resolved.plan] : PLAN_CONFIG.trial

  function gate(resource: UsageResource, count: number): UsageGateResult {
    if (!active) return { result: 'hard_blocked', used: count, limit: 0, pct: 100 }
    const limit = getLimitForResource(limits, resource)
    if (limit === UNLIMITED) return { result: 'allowed', used: count, limit: UNLIMITED, pct: 0 }
    const pct = Math.min(100, Math.round((count / limit) * 100))
    if (count >= limit) return { result: 'hard_blocked', used: count, limit, pct: 100 }
    if (count >= Math.floor(limit * SOFT_BLOCK_THRESHOLD)) return { result: 'soft_blocked', used: count, limit, pct }
    return { result: 'allowed', used: count, limit, pct }
  }

  return {
    sub: resolved,
    limits,
    usage: {
      leads:        gate('leads',        currentUsage.leads),
      appointments: gate('appointments', currentUsage.appointments),
      users:        gate('users',        currentUsage.users),
    },
    isActive: active,
    trialDaysLeft: trialDaysRemaining(resolved),
  }
}
