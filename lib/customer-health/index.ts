import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG, UNLIMITED } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

// ── Raw types from DB ────────────────────────────────────────
type ClinicRow  = { id: string; name: string; plan: string; subscription_status: string }
type UsageRow   = { clinic_id: string; leads_count: number; appointments_count: number }
type ApptRow    = { clinic_id: string; status: string; scheduled_at: string }
type PatientRow = { clinic_id: string; created_at: string }
type GatingRow  = { clinic_id: string; event: string; gate_state: string | null; created_at: string }

// ── Public types ─────────────────────────────────────────────
export type HealthStatus = 'healthy' | 'watch' | 'at_risk' | 'churned'

export type AlertType =
  | 'at_risk'        // score < 45 and still active
  | 'churned'        // score < 40 and no activity > 30 days
  | 'inactive'       // no activity ≥ 21 days
  | 'declining'      // this week < 50% of last week (if last week had data)
  | 'high_friction'  // hard blocks ≥ 3, zero CTAs
  | 'upgrade_ready'  // score ≥ 65 and usage ≥ 75%

export interface HealthScore {
  total:    number  // 0-100
  recency:  number  // 0-20: how recently was the app used?
  volume:   number  // 0-20: are they meaningfully using their plan?
  quality:  number  // 0-20: appointment completion rate
  growth:   number  // 0-20: new patients week-over-week
  friction: number  // 0-20: inverse of gating blocks
}

export interface ClinicHealth {
  clinicId:        string
  clinicName:      string
  plan:            string
  subscriptionStatus: string
  healthStatus:    HealthStatus
  score:           HealthScore
  alerts:          AlertType[]
  leadsUsedPct:    number   // 0-100
  apptTrend:       number   // % change week-over-week (can be negative)
  lastActivityDays: number  // days since last appointment/patient
}

// ── Scoring ──────────────────────────────────────────────────

function daysSince(iso: string | null): number {
  if (!iso) return 999
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function safePct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

function scoreRecency(days: number): number {
  if (days <= 2)  return 20
  if (days <= 7)  return 14
  if (days <= 14) return 8
  if (days <= 30) return 2
  return 0
}

function scoreVolume(usedPct: number, isUnlimitedPlan: boolean): number {
  if (isUnlimitedPlan) return 15  // unlimited → assume healthy, small bonus cap
  if (usedPct === 0)       return 0
  if (usedPct < 5)         return 3
  if (usedPct < 20)        return 10
  if (usedPct <= 80)       return 20  // sweet spot
  if (usedPct <= 90)       return 14  // approaching limit
  return 8                             // at/over limit (frustrating but active)
}

function scoreQuality(completed: number, noShows: number, totalAppts: number): number {
  if (totalAppts === 0) return 10  // no data → neutral
  const completionRate = completed / totalAppts
  if (completionRate >= 0.85) return 20
  if (completionRate >= 0.70) return 14
  if (completionRate >= 0.50) return 8
  if (completionRate > 0)     return 3
  return 2
}

function scoreGrowth(thisWeek: number, lastWeek: number): number {
  if (thisWeek > lastWeek)             return 20
  if (thisWeek > 0 && thisWeek === lastWeek) return 14
  if (thisWeek > 0)                    return 8
  if (lastWeek > 0)                    return 3  // dropped to zero
  return 6                                        // zero in both — neutral
}

function scoreFriction(hardBlocks: number, softBlocks: number, ctaClicks: number): number {
  if (hardBlocks === 0 && softBlocks === 0) return 20
  if (hardBlocks === 0)                     return 14
  if (ctaClicks > 0)                        return 10  // frustrated but intent to upgrade
  if (hardBlocks >= 3)                      return 2   // stuck and not converting
  return 6
}

function deriveHealthStatus(score: number, lastActivityDays: number): HealthStatus {
  if (lastActivityDays > 30 && score < 40) return 'churned'
  if (score >= 70)                          return 'healthy'
  if (score >= 45)                          return 'watch'
  return 'at_risk'
}

function deriveAlerts(
  lastActivityDays: number,
  apptsThisWeek: number,
  apptsLastWeek: number,
  hardBlocks: number,
  ctaClicks: number,
  score: number,
  leadsUsedPct: number,
): AlertType[] {
  const alerts: AlertType[] = []

  // Status-based alerts (mutually exclusive — worst wins)
  if (lastActivityDays > 30 && score < 40) {
    alerts.push('churned')
  } else if (score < 45) {
    alerts.push('at_risk')
  } else if (lastActivityDays >= 21) {
    alerts.push('inactive')   // inactive but not yet at_risk score
  }

  // Signal-based alerts (independent)
  if (apptsLastWeek >= 3 && apptsThisWeek < apptsLastWeek * 0.5) alerts.push('declining')
  if (hardBlocks >= 3 && ctaClicks === 0)                         alerts.push('high_friction')
  if (score >= 65 && leadsUsedPct >= 75)                          alerts.push('upgrade_ready')

  return alerts
}

// ── Data fetching ────────────────────────────────────────────

export async function fetchAllClinicHealth(): Promise<ClinicHealth[]> {
  const supabase = createAdminClient()
  const now = new Date()

  const d = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [clinicsRes, usageRes, apptsRes, patientsRes, gatingRes] = await Promise.all([
    supabase.from('clinics')
      .select('id, name, plan, subscription_status')
      .neq('subscription_status', 'cancelled'),

    supabase.from('subscription_usage')
      .select('clinic_id, leads_count, appointments_count')
      .eq('period_start', periodStart),

    // 30 days: enough for recency (30d window) and trend (split at 7 + 14)
    supabase.from('appointments')
      .select('clinic_id, status, scheduled_at')
      .gte('scheduled_at', d(30)),

    // 14 days: this-week vs last-week patient growth
    supabase.from('patients')
      .select('clinic_id, created_at')
      .gte('created_at', d(14))
      .neq('status', 'lead'),

    // 7 days: friction is a short-window signal
    supabase.from('gating_events')
      .select('clinic_id, event, gate_state, created_at')
      .gte('created_at', d(7)),
  ])

  const clinics  = (clinicsRes.data  ?? []) as unknown as ClinicRow[]
  const usageMap = new Map<string, UsageRow>(
    ((usageRes.data ?? []) as unknown as UsageRow[]).map((u) => [u.clinic_id, u])
  )
  const allAppts    = (apptsRes.data    ?? []) as unknown as ApptRow[]
  const allPatients = (patientsRes.data ?? []) as unknown as PatientRow[]
  const allGating   = (gatingRes.data   ?? []) as unknown as GatingRow[]

  const sevenDaysAgo    = new Date(now.getTime() - 7  * 86_400_000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000)

  return clinics.map((clinic) => {
    const usage   = usageMap.get(clinic.id)
    const appts   = allAppts.filter((a) => a.clinic_id === clinic.id)
    const patients = allPatients.filter((p) => p.clinic_id === clinic.id)
    const gating  = allGating.filter((g) => g.clinic_id === clinic.id)

    // Split appointments by time window
    const apptsThisWeek = appts.filter((a) => new Date(a.scheduled_at) >= sevenDaysAgo)
    const apptsLastWeek = appts.filter(
      (a) => new Date(a.scheduled_at) >= fourteenDaysAgo && new Date(a.scheduled_at) < sevenDaysAgo
    )

    // Split patients by time window
    const patientsThisWeek = patients.filter((p) => new Date(p.created_at) >= sevenDaysAgo)
    const patientsLastWeek = patients.filter(
      (p) => new Date(p.created_at) >= fourteenDaysAgo && new Date(p.created_at) < sevenDaysAgo
    )

    // Recency: most recent appointment in 30-day window
    const latestAppt = appts
      .map((a) => a.scheduled_at)
      .sort()
      .at(-1) ?? null
    const lastActivityDays = daysSince(latestAppt)

    // Usage
    const plan        = clinic.plan as Plan
    const limits      = PLAN_CONFIG[plan] ?? PLAN_CONFIG.trial
    const leadsLimit  = limits.leads_per_month
    const leadsUsed   = usage?.leads_count ?? 0
    const isUnlimited = leadsLimit === UNLIMITED
    const leadsUsedPct = isUnlimited ? 0 : Math.min(100, safePct(leadsUsed, leadsLimit))

    // Appointment quality (30-day window)
    const totalAppts30 = appts.length
    const completedAppts = appts.filter((a) => a.status === 'completed').length
    const noShowAppts    = appts.filter((a) => a.status === 'no_show').length

    // Gating signals
    const hardBlocks = gating.filter((g) => g.gate_state === 'hard_blocked').length
    const softBlocks = gating.filter((g) => g.gate_state === 'soft_blocked').length
    const ctaClicks  = gating.filter((g) => g.event === 'cta_primary_clicked').length

    // Score dimensions
    const recency  = scoreRecency(lastActivityDays)
    const volume   = scoreVolume(leadsUsedPct, isUnlimited)
    const quality  = scoreQuality(completedAppts, noShowAppts, totalAppts30)
    const growth   = scoreGrowth(patientsThisWeek.length, patientsLastWeek.length)
    const friction = scoreFriction(hardBlocks, softBlocks, ctaClicks)
    const total    = recency + volume + quality + growth + friction

    const healthStatus   = deriveHealthStatus(total, lastActivityDays)
    const apptTrend      = safePct(apptsThisWeek.length - apptsLastWeek.length, Math.max(1, apptsLastWeek.length))
    const alerts         = deriveAlerts(
      lastActivityDays, apptsThisWeek.length, apptsLastWeek.length,
      hardBlocks, ctaClicks, total, leadsUsedPct
    )

    return {
      clinicId:           clinic.id,
      clinicName:         clinic.name,
      plan:               clinic.plan,
      subscriptionStatus: clinic.subscription_status,
      healthStatus,
      score: { total, recency, volume, quality, growth, friction },
      alerts,
      leadsUsedPct,
      apptTrend,
      lastActivityDays,
    }
  }).sort((a, b) => a.score.total - b.score.total)  // default: worst first
}
