import { createClient } from '@/lib/supabase/server'

type UsageField = 'leads' | 'appointments'

function currentPeriodStart(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export interface MonthlyUsage {
  leads: number
  appointments: number
  ai_messages: number
  period_start: string
}

export async function getMonthlyUsage(organizationId: string): Promise<MonthlyUsage> {
  const supabase = await createClient()
  const period = currentPeriodStart()

  const { data } = await (supabase as any)
    .from('subscription_usage')
    .select('leads, appointments, ai_messages, period_start')
    .eq('organization_id', organizationId)
    .eq('period_start', period)
    .single()

  return data ?? {
    leads: 0,
    appointments: 0,
    ai_messages: 0,
    period_start: period,
  }
}

export async function getActiveUserCount(organizationId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await (supabase as any)
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  return count ?? 0
}

export async function incrementUsage(organizationId: string, field: UsageField): Promise<void> {
  const supabase = await createClient()
  await (supabase as any).rpc('increment_usage', {
    p_organization_id: organizationId,
    p_period_start: currentPeriodStart(),
    p_field: field,
  })
}

export async function getFullUsage(
  organizationId: string
): Promise<{ leads: number; appointments: number; users: number }> {
  const [usage, users] = await Promise.all([
    getMonthlyUsage(organizationId),
    getActiveUserCount(organizationId),
  ])
  return {
    leads:        usage.leads,
    appointments: usage.appointments,
    users,
  }
}
