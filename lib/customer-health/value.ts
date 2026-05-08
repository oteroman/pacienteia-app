import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG, UNLIMITED } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

// ── ROI unit values (conservative Lima aesthetic market) ──────
// lead:            S/150  — conservative ticket mix (botox / HIFU / faciales)
// confirmed:       S/80   — net value of a kept appointment
// no_show_avoided: S/80   — vs ~25% industry baseline without reminder system
// new_patient:     S/200  — LTV signal for a converted + retained patient
// task_closed:     S/50   — CS intervention value (time + opportunity saved)
export const ROI_PEN = {
  lead:            150,
  confirmed:        80,
  no_show_avoided:  80,
  new_patient:     200,
  task_closed:      50,
} as const

// Industry no-show baseline without automated reminders (~Lima aesthetic market)
export const NO_SHOW_BASELINE = 0.25

// ── Types ─────────────────────────────────────────────────────
export interface ValueScore {
  total:     number  // 0-100
  leads:     number  // 0-25
  confirmed: number  // 0-25
  noShow:    number  // 0-15
  patients:  number  // 0-15  (reactivated patients)
  tasks:     number  // 0-10
  activity:  number  // 0-10
}

export interface ClinicROI {
  // Rolling windows
  roi7d:     number
  roi30d:    number
  // Historical (since account creation)
  roiHistorical:           number
  multiplier:              number  // roi30d  / planCost
  multiplierHistorical:    number  // roiHistorical / planCost
  planCost:  number
  // 30d breakdown (used in breakdown strip)
  fromLeads:       number
  fromConfirmed:   number
  fromNoShow:      number
  fromReactivated: number
  fromTasks:       number
}

export interface ClinicValue {
  clinicId:        string
  clinicName:      string
  plan:            string
  valueScore:      ValueScore
  roi:             ClinicROI
  reactivated30d:  number   // exposed for display
  topAction:       string   // human-readable top value driver
  message:         string   // commercial message for CS
  isHighValueLowPlan:   boolean  // roi30d ≥ 2× plan cost AND not premium
  isLowValueToActivate: boolean  // value score < 35
}

// ── Raw DB types ──────────────────────────────────────────────
type ClinicRow  = { id: string; name: string; plan: string }
type UsageRow   = { organization_id: string; leads_count: number }
type ApptRow    = { organization_id: string; status: string; scheduled_at: string }
type ApptStatusRow = { organization_id: string; status: string }
type GatingRow  = { organization_id: string; created_at: string }
type TaskRow    = { organization_id: string; resolved_at: string | null }
type PatientRow = { organization_id: string }
type ReactivatedRow = { organization_id: string; reactivated_count: number }

// ── Score helpers ─────────────────────────────────────────────
function scoreLeads(leads30d: number, planLeadLimit: number): number {
  const cap = planLeadLimit === UNLIMITED ? 1000 : planLeadLimit
  return Math.round(Math.min(leads30d / cap, 1) * 25)
}

function scoreConfirmed(confirmed30d: number): number {
  return Math.round(Math.min(confirmed30d / 15, 1) * 25)
}

function scoreNoShow(noShows: number, totalAppts: number): number {
  if (totalAppts === 0) return 10
  const rate = noShows / totalAppts
  if (rate === 0)   return 15
  if (rate < 0.10)  return 12
  if (rate < 0.20)  return 8
  if (rate < 0.30)  return 4
  return 0
}

// "patients" dimension now uses reactivated count (real signal, not proxy)
function scorePatients(reactivated30d: number): number {
  return Math.round(Math.min(reactivated30d / 5, 1) * 15)
}

function scoreTasks(tasksDone30d: number): number {
  return Math.round(Math.min(tasksDone30d / 3, 1) * 10)
}

function scoreActivity(activeDays30d: number): number {
  return Math.round(Math.min(activeDays30d / 20, 1) * 10)
}

// ── Commercial message ────────────────────────────────────────
function deriveMessage(roi30d: number, planCost: number): string {
  if (planCost === 0) return 'Plan trial activo.'
  const mult = roi30d / planCost
  if (mult >= 3)   return `Ya recuperaste ${mult.toFixed(1)}x el valor de tu plan este mes.`
  if (mult >= 1)   return `Ya cubriste el costo del plan. Generaste S/ ${Math.round(roi30d - planCost).toLocaleString('es-PE')} extra.`
  if (mult >= 0.5) return `Vas bien — recuperaste el ${Math.round(mult * 100)}% del costo de tu plan.`
  return 'Activa más citas y leads para maximizar tu ROI.'
}

// ── Top value driver ──────────────────────────────────────────
function deriveTopAction(
  fromLeads: number, fromConfirmed: number, fromNoShow: number, fromReactivated: number,
): string {
  const parts = [
    { label: 'Leads recuperados',      val: fromLeads },
    { label: 'Citas confirmadas',       val: fromConfirmed },
    { label: 'No-shows evitados',       val: fromNoShow },
    { label: 'Pacientes reactivados',   val: fromReactivated },
  ]
  const top = parts.sort((a, b) => b.val - a.val)[0]
  return top.val > 0 ? `${top.label} (S/ ${top.val.toLocaleString('es-PE')})` : 'Sin actividad registrada'
}

// ── Fetch ──────────────────────────────────────────────────────
export async function fetchAllClinicValue(): Promise<ClinicValue[]> {
  const supabase = createAdminClient()
  const now = new Date()
  const d = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)
  const periodStart  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // 10 parallel queries: 5 rolling (30d) + 4 historical (all-time) + 1 RPC
  const [
    clinicsRes,
    usageRes,       // leads: current month only (MTD)
    apptsRes,       // appointments: last 30d (status + scheduled_at for 7d split)
    gatingRes,      // gating events: 30d (active-days signal)
    tasksRes,       // tasks done: last 30d
    histUsageRes,   // leads: ALL periods (for historical sum)
    histApptsRes,   // appointments: ALL time, just clinic_id + status
    histPatientsRes,// patients: ALL time, non-lead (historical new_patient signal)
    histTasksRes,   // tasks done: ALL time
    reactivatedRes, // RPC: real reactivation counts per clinic (30d window)
  ] = await Promise.all([
    sb.from('organizations').select('id, name, plan').neq('subscription_status', 'cancelled'),
    sb.from('subscription_usage').select('organization_id, leads_count').eq('period_start', periodStart),
    sb.from('appointments').select('organization_id, status, scheduled_at').gte('scheduled_at', d(30)),
    sb.from('gating_events').select('organization_id, created_at').gte('created_at', d(30)),
    sb.from('clinic_tasks').select('organization_id, resolved_at').eq('status', 'done').gte('resolved_at', d(30)),
    sb.from('subscription_usage').select('organization_id, leads_count'),          // all periods
    sb.from('appointments').select('organization_id, status'),                      // all time
    sb.from('patients').select('organization_id').neq('status', 'lead'),            // all time
    sb.from('clinic_tasks').select('organization_id').eq('status', 'done'),         // all time
    sb.rpc('get_reactivated_patients_30d'),                                   // aggregated RPC
  ])

  const clinics  = (clinicsRes.data  ?? []) as ClinicRow[]
  const usageMap = new Map<string, number>(
    ((usageRes.data ?? []) as UsageRow[]).map((u) => [u.organization_id, u.leads_count])
  )
  const allAppts30   = (apptsRes.data    ?? []) as ApptRow[]
  const allGating    = (gatingRes.data   ?? []) as GatingRow[]
  const allTasks30   = (tasksRes.data    ?? []) as TaskRow[]

  // Historical: pre-aggregate into Maps to avoid repeated full-array scans per clinic
  const histUsageMap = new Map<string, number>()
  for (const r of (histUsageRes.data ?? []) as UsageRow[]) {
    histUsageMap.set(r.organization_id, (histUsageMap.get(r.organization_id) ?? 0) + r.leads_count)
  }

  type ApptCounts = { confirmed: number; noShow: number; total: number }
  const histApptsMap = new Map<string, ApptCounts>()
  for (const r of (histApptsRes.data ?? []) as ApptStatusRow[]) {
    const curr = histApptsMap.get(r.organization_id) ?? { confirmed: 0, noShow: 0, total: 0 }
    curr.total++
    if (r.status === 'confirmed' || r.status === 'completed') curr.confirmed++
    if (r.status === 'no_show') curr.noShow++
    histApptsMap.set(r.organization_id, curr)
  }

  const histPatientsMap = new Map<string, number>()
  for (const r of (histPatientsRes.data ?? []) as PatientRow[]) {
    histPatientsMap.set(r.organization_id, (histPatientsMap.get(r.organization_id) ?? 0) + 1)
  }

  const histTasksMap = new Map<string, number>()
  for (const r of (histTasksRes.data ?? []) as PatientRow[]) {
    histTasksMap.set(r.organization_id, (histTasksMap.get(r.organization_id) ?? 0) + 1)
  }

  const reactivatedMap = new Map<string, number>(
    ((reactivatedRes.data ?? []) as ReactivatedRow[])
      .map((r) => [r.organization_id, Number(r.reactivated_count)])
  )

  return clinics.map((clinic) => {
    // ── 30d rolling data ────────────────────────────────────
    const appts30 = allAppts30.filter((a) => a.organization_id === clinic.id)
    const gating  = allGating.filter((g) => g.organization_id === clinic.id)
    const tasks30 = allTasks30.filter((t) => t.organization_id === clinic.id)

    const appts7d = appts30.filter((a) => new Date(a.scheduled_at) >= sevenDaysAgo)
    const tasks7d = tasks30.filter((t) => t.resolved_at && new Date(t.resolved_at) >= sevenDaysAgo)

    const leads30d       = usageMap.get(clinic.id) ?? 0
    const confirmed30d   = appts30.filter((a) => a.status === 'confirmed' || a.status === 'completed').length
    const noShows30d     = appts30.filter((a) => a.status === 'no_show').length
    const reactivated30d = reactivatedMap.get(clinic.id) ?? 0
    const tasksDone30d   = tasks30.length

    const confirmed7d = appts7d.filter((a) => a.status === 'confirmed' || a.status === 'completed').length
    const noShows7d   = appts7d.filter((a) => a.status === 'no_show').length
    const leads7d_est = Math.round(leads30d * (7 / 30))  // approximation (usage table is monthly)
    const tasks7d_n   = tasks7d.length

    // Active days: distinct calendar dates with any appointment or gating event
    const activeDates = new Set<string>([
      ...appts30.map((a) => a.scheduled_at.slice(0, 10)),
      ...gating.map((g) => g.created_at.slice(0, 10)),
    ])
    const activeDays30d = activeDates.size

    // ── Historical data ──────────────────────────────────────
    const histLeads   = histUsageMap.get(clinic.id) ?? 0
    const histAppts   = histApptsMap.get(clinic.id) ?? { confirmed: 0, noShow: 0, total: 0 }
    const histPats    = histPatientsMap.get(clinic.id) ?? 0
    const histTasks   = histTasksMap.get(clinic.id) ?? 0

    // ── Plan config ──────────────────────────────────────────
    const plan       = clinic.plan as Plan
    const planConfig = PLAN_CONFIG[plan] ?? PLAN_CONFIG.basic
    const planCost   = planConfig.price_pen
    const leadLimit  = planConfig.leads_per_month

    // ── Value score ──────────────────────────────────────────
    const sLeads     = scoreLeads(leads30d, leadLimit)
    const sConfirmed = scoreConfirmed(confirmed30d)
    const sNoShow    = scoreNoShow(noShows30d, appts30.length)
    const sPatients  = scorePatients(reactivated30d)  // real reactivation signal
    const sTasks     = scoreTasks(tasksDone30d)
    const sActivity  = scoreActivity(activeDays30d)
    const scoreTotal = sLeads + sConfirmed + sNoShow + sPatients + sTasks + sActivity

    // ── ROI 30d breakdown ────────────────────────────────────
    const avoided30d      = Math.max(0, Math.round(appts30.length * NO_SHOW_BASELINE) - noShows30d)
    const fromLeads       = leads30d       * ROI_PEN.lead
    const fromConfirmed   = confirmed30d   * ROI_PEN.confirmed
    const fromNoShow      = avoided30d     * ROI_PEN.no_show_avoided
    const fromReactivated = reactivated30d * ROI_PEN.new_patient
    const fromTasks       = tasksDone30d   * ROI_PEN.task_closed
    const roi30d          = fromLeads + fromConfirmed + fromNoShow + fromReactivated + fromTasks

    // ── ROI 7d ───────────────────────────────────────────────
    const avoided7d = Math.max(0, Math.round(appts7d.length * NO_SHOW_BASELINE) - noShows7d)
    const roi7d     = leads7d_est * ROI_PEN.lead
                    + confirmed7d * ROI_PEN.confirmed
                    + avoided7d   * ROI_PEN.no_show_avoided
                    + tasks7d_n   * ROI_PEN.task_closed
                    // 7d reactivation: not separately tracked, reactivated30d/4 as rough split
                    + Math.round(reactivated30d / 4) * ROI_PEN.new_patient

    // ── ROI histórico ────────────────────────────────────────
    const histAvoided    = Math.max(0, Math.round(histAppts.total * NO_SHOW_BASELINE) - histAppts.noShow)
    const roiHistorical  = histLeads         * ROI_PEN.lead
                         + histAppts.confirmed * ROI_PEN.confirmed
                         + histAvoided        * ROI_PEN.no_show_avoided
                         + histPats           * ROI_PEN.new_patient
                         + histTasks          * ROI_PEN.task_closed

    const multiplier            = planCost > 0 ? roi30d         / planCost : 0
    const multiplierHistorical  = planCost > 0 ? roiHistorical  / planCost : 0

    return {
      clinicId:        clinic.id,
      clinicName:      clinic.name,
      plan:            clinic.plan,
      reactivated30d,
      valueScore: {
        total: scoreTotal, leads: sLeads, confirmed: sConfirmed,
        noShow: sNoShow, patients: sPatients, tasks: sTasks, activity: sActivity,
      },
      roi: {
        roi7d, roi30d, roiHistorical,
        multiplier, multiplierHistorical, planCost,
        fromLeads, fromConfirmed, fromNoShow, fromReactivated, fromTasks,
      },
      topAction: deriveTopAction(fromLeads, fromConfirmed, fromNoShow, fromReactivated),
      message:   deriveMessage(roi30d, planCost),
      isHighValueLowPlan:   multiplier >= 2 && plan !== 'premium',
      isLowValueToActivate: scoreTotal < 35,
    }
  }).sort((a, b) => b.roi.roi30d - a.roi.roi30d)
}

// ── Single-clinic fetch (owner-facing, multi-tenant safe) ─────
// Uses fetchAllClinicValue and filters — avoids duplicating computation logic.
// Server-side only; no cross-clinic data is ever returned to the browser.
export async function fetchClinicValue(clinicId: string): Promise<ClinicValue | null> {
  const all = await fetchAllClinicValue()
  return all.find((c) => c.clinicId === clinicId) ?? null
}
