import { createAdminClient } from '@/lib/supabase/admin'

// ── Period helpers ────────────────────────────────────────────
export type PeriodKey = 'week' | 'month' | '30d'

export interface KPIPeriod {
  key:   PeriodKey
  label: string
  start: string   // ISO UTC
  end:   string   // ISO UTC
}

export function buildPeriod(key: PeriodKey = '30d'): KPIPeriod {
  const now = new Date()
  const end = now.toISOString()

  if (key === 'week') {
    return { key, label: 'Últimos 7 días',  start: new Date(now.getTime() - 7  * 86_400_000).toISOString(), end }
  }
  if (key === 'month') {
    return { key, label: 'Este mes', start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end }
  }
  return   { key, label: 'Últimos 30 días', start: new Date(now.getTime() - 30 * 86_400_000).toISOString(), end }
}

function prevPeriod(p: KPIPeriod): KPIPeriod {
  const len = new Date(p.end).getTime() - new Date(p.start).getTime()
  return {
    key:   p.key,
    label: `Período anterior`,
    start: new Date(new Date(p.start).getTime() - len).toISOString(),
    end:   p.start,
  }
}

// ── KPI types ─────────────────────────────────────────────────
export interface ClinicKPIs {
  period: KPIPeriod
  // Appointment funnel
  apptsCreated:     number
  apptsCompleted:   number
  noShows:          number
  cancellations:    number
  cancellationRate: number   // 0-100
  // Scheduling recovery
  slotsOpened:      number
  slotsFilled:      number
  fillRate:         number   // 0-100
  rebooksTotal:     number
  rebooksSuccess:   number
  rebookRate:       number   // 0-100
  // Intake / SLA
  intakesTotal:     number
  intakesResolved:  number
  resolutionRate:   number   // 0-100
  slaMetCount:      number
  slaTotalCount:    number
  slaMetRate:       number   // 0-100
  // Revenue (estimates)
  avgPrice:         number
  revenueActual:    number
  revenueRecovered: number   // (rebooks + fills) * avgPrice
  revenueAtRisk:    number   // (noShows + cancellations) * avgPrice
}

export interface ClinicKPIWithTrend extends ClinicKPIs {
  prev: ClinicKPIs
  trends: {
    fillRate:         'up' | 'flat' | 'down'
    slaMetRate:       'up' | 'flat' | 'down'
    revenueActual:    'up' | 'flat' | 'down'
    revenueRecovered: 'up' | 'flat' | 'down'
  }
}

export interface AllClinicsRow {
  clinicId:       string
  clinicName:     string
  completed:      number
  cancellations:  number
  fillRate:       number
  revenueActual:  number
  recoveredValue: number
  slaMetRate:     number
  score:          number   // 0-100 composite
}

export interface NetworkBenchmarks {
  medianFillRate:  number
  medianSlaRate:   number
  medianRecovered: number
}

// ── Core KPI query ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryKPIs(sb: any, clinicId: string, period: KPIPeriod): Promise<ClinicKPIs> {
  const { start, end } = period

  const [apptRes, slotRes, rebookRes, intakeRes, slaRes] = await Promise.all([
    sb.from('appointments')
      .select('status, price')
      .eq('clinic_id', clinicId)
      .gte('created_at', start)
      .lte('created_at', end)
      .is('deleted_at', null),

    sb.from('slot_openings')
      .select('status')
      .eq('clinic_id', clinicId)
      .gte('created_at', start)
      .lte('created_at', end),

    sb.from('appointment_rebooking')
      .select('outcome')
      .eq('clinic_id', clinicId)
      .gte('created_at', start)
      .lte('created_at', end),

    sb.from('intakes')
      .select('status')
      .eq('clinic_id', clinicId)
      .gte('created_at', start)
      .lte('created_at', end),

    // SLA: intakes that have both first_response_at and sla_due_at
    sb.from('intakes')
      .select('first_response_at, sla_due_at')
      .eq('clinic_id', clinicId)
      .not('first_response_at', 'is', null)
      .not('sla_due_at', 'is', null)
      .gte('created_at', start)
      .lte('created_at', end),
  ])

  type Appt   = { status: string; price: number | null }
  type Slot   = { status: string }
  type Rebook = { outcome: string }
  type Intake = { status: string }
  type SLARow = { first_response_at: string; sla_due_at: string }

  const appts   = (apptRes.data   ?? []) as Appt[]
  const slots   = (slotRes.data   ?? []) as Slot[]
  const rebooks = (rebookRes.data ?? []) as Rebook[]
  const intakes = (intakeRes.data ?? []) as Intake[]
  const slaRows = (slaRes.data    ?? []) as SLARow[]

  // Appointments
  const apptsCreated   = appts.length
  const apptsCompleted = appts.filter((a) => a.status === 'completed').length
  const noShows        = appts.filter((a) => a.status === 'no_show').length
  const cancellations  = appts.filter((a) => a.status === 'cancelled').length

  // Revenue
  const completedWithPrice = appts.filter((a) => a.status === 'completed' && a.price != null)
  const revenueActual = completedWithPrice.reduce((s, a) => s + (a.price ?? 0), 0)
  const avgPrice = completedWithPrice.length > 0 ? revenueActual / completedWithPrice.length : 0

  // Slots
  const slotsOpened = slots.length
  const slotsFilled = slots.filter((s) => s.status === 'filled').length
  const fillRate    = slotsOpened > 0 ? Math.round((slotsFilled / slotsOpened) * 100) : 0

  // Rebooks
  const rebooksTotal   = rebooks.length
  const rebooksSuccess = rebooks.filter((r) => r.outcome === 'rebooked').length
  const rebookRate     = rebooksTotal > 0 ? Math.round((rebooksSuccess / rebooksTotal) * 100) : 0

  // Intakes
  const intakesTotal    = intakes.length
  const intakesResolved = intakes.filter((i) => i.status === 'resolved').length
  const resolutionRate  = intakesTotal > 0 ? Math.round((intakesResolved / intakesTotal) * 100) : 0

  // SLA
  const slaTotalCount = slaRows.length
  const slaMetCount   = slaRows.filter(
    (r) => new Date(r.first_response_at) <= new Date(r.sla_due_at),
  ).length
  const slaMetRate = slaTotalCount > 0 ? Math.round((slaMetCount / slaTotalCount) * 100) : 0

  // Derived revenue estimates
  const revenueRecovered = (rebooksSuccess + slotsFilled) * avgPrice
  const revenueAtRisk    = (noShows + cancellations) * avgPrice
  const cancellationRate = apptsCreated > 0
    ? Math.round(((noShows + cancellations) / apptsCreated) * 100)
    : 0

  return {
    period,
    apptsCreated, apptsCompleted, noShows, cancellations, cancellationRate,
    slotsOpened, slotsFilled, fillRate,
    rebooksTotal, rebooksSuccess, rebookRate,
    intakesTotal, intakesResolved, resolutionRate,
    slaMetCount, slaTotalCount, slaMetRate,
    avgPrice, revenueActual, revenueRecovered, revenueAtRisk,
  }
}

// ── Public fetchers ───────────────────────────────────────────
export async function fetchClinicKPIsWithTrend(
  clinicId: string,
  periodKey: PeriodKey = '30d',
): Promise<ClinicKPIWithTrend> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = createAdminClient() as any
  const cur = buildPeriod(periodKey)
  const prv = prevPeriod(cur)

  const [current, prev] = await Promise.all([
    queryKPIs(sb, clinicId, cur),
    queryKPIs(sb, clinicId, prv),
  ])

  function trend(cur: number, prv: number): 'up' | 'flat' | 'down' {
    if (prv === 0) return cur > 0 ? 'up' : 'flat'
    const delta = (cur - prv) / prv
    if (delta >  0.1) return 'up'
    if (delta < -0.1) return 'down'
    return 'flat'
  }

  return {
    ...current,
    prev,
    trends: {
      fillRate:         trend(current.fillRate,         prev.fillRate),
      slaMetRate:       trend(current.slaMetRate,       prev.slaMetRate),
      revenueActual:    trend(current.revenueActual,    prev.revenueActual),
      revenueRecovered: trend(current.revenueRecovered, prev.revenueRecovered),
    },
  }
}

export async function fetchAllClinicsPerformance(
  periodKey: PeriodKey = '30d',
): Promise<AllClinicsRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb     = createAdminClient() as any
  const period = buildPeriod(periodKey)
  const { start, end } = period

  const { data: clinics } = await sb.from('clinics').select('id, name')
  if (!clinics?.length) return []

  const rows = await Promise.all(
    (clinics as { id: string; name: string }[]).map(async (c) => {
      const kpi = await queryKPIs(sb, c.id, period)
      // Composite score: weighted average of fill rate (40%), SLA rate (30%), resolution rate (30%)
      const score = Math.round(kpi.fillRate * 0.4 + kpi.slaMetRate * 0.3 + kpi.resolutionRate * 0.3)
      return {
        clinicId:       c.id,
        clinicName:     c.name,
        completed:      kpi.apptsCompleted,
        cancellations:  kpi.cancellations,
        fillRate:       kpi.fillRate,
        revenueActual:  kpi.revenueActual,
        recoveredValue: kpi.revenueRecovered,
        slaMetRate:     kpi.slaMetRate,
        score,
      } satisfies AllClinicsRow
    }),
  )

  return rows.sort((a, b) => b.score - a.score)
}

export async function fetchNetworkBenchmarks(periodKey: PeriodKey = '30d'): Promise<NetworkBenchmarks> {
  const rows = await fetchAllClinicsPerformance(periodKey)
  if (rows.length === 0) return { medianFillRate: 0, medianSlaRate: 0, medianRecovered: 0 }

  const med = <T>(arr: T[], key: keyof T) => {
    const sorted = [...arr].sort((a, b) => Number(a[key]) - Number(b[key]))
    const mid    = Math.floor(sorted.length / 2)
    return Number(sorted[mid]?.[key] ?? 0)
  }

  return {
    medianFillRate:  med(rows, 'fillRate'),
    medianSlaRate:   med(rows, 'slaMetRate'),
    medianRecovered: med(rows, 'recoveredValue'),
  }
}
