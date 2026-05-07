// ============================================================
// PacienteIA — Monthly usage tracking
// Call incrementUsage() in Server Actions when a resource is
// created. Counters reset automatically on new month period.
// ============================================================

import { createClient } from '@/lib/supabase/server'

type UsageField = 'leads_count' | 'appointments_count'

/** Returns the first day of the current month as a DATE string (YYYY-MM-DD) */
function currentPeriodStart(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

// ─────────────────────────────────────────
// Read
// ─────────────────────────────────────────

export interface MonthlyUsage {
  leads_count: number
  appointments_count: number
  active_users: number
  period_start: string
}

export async function getMonthlyUsage(clinicId: string): Promise<MonthlyUsage> {
  const supabase = await createClient()
  const period = currentPeriodStart()

  const { data } = await supabase
    .from('subscription_usage')
    .select('leads_count, appointments_count, active_users, period_start')
    .eq('clinic_id', clinicId)
    .eq('period_start', period)
    .single()

  return data ?? {
    leads_count: 0,
    appointments_count: 0,
    active_users: 0,
    period_start: period,
  }
}

/** Active user count: members who have created/updated something this month.
 *  For now we derive this from clinic_members total — refine later if needed. */
export async function getActiveUserCount(clinicId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('clinic_members')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)

  return count ?? 0
}

// ─────────────────────────────────────────
// Write (atomic via Supabase RPC)
// ─────────────────────────────────────────

export async function incrementUsage(clinicId: string, field: UsageField): Promise<void> {
  const supabase = await createClient()
  // RPC not yet in generated types — cast to any for the call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('increment_usage', {
    p_clinic_id: clinicId,
    p_period_start: currentPeriodStart(),
    p_field: field,
  })
}

// ─────────────────────────────────────────
// Convenience: read usage + active users in one call
// Used by gating and billing page
// ─────────────────────────────────────────

export async function getFullUsage(
  clinicId: string
): Promise<{ leads: number; appointments: number; users: number }> {
  const [usage, users] = await Promise.all([
    getMonthlyUsage(clinicId),
    getActiveUserCount(clinicId),
  ])
  return {
    leads:        usage.leads_count,
    appointments: usage.appointments_count,
    users,
  }
}
