import { redirect }           from 'next/navigation'
import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { getActiveContext }   from '@/lib/tenant/context'
import WeeklyCalendar         from './WeeklyCalendar'
import DayCalendar            from './DayCalendar'

// ── Lima timezone helpers (UTC-5, no DST) ────────────────────────────────────

export const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000

export function utcToLima(utcMs: number): Date {
  return new Date(utcMs + LIMA_OFFSET_MS)
}

export function toDateISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function getMondayISO(weekParam?: string): string {
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) return weekParam
  const todayLima = utcToLima(Date.now())
  const dow       = todayLima.getUTCDay()
  const daysBack  = dow === 0 ? 6 : dow - 1
  const monday    = new Date(todayLima.getTime() - daysBack * 86_400_000)
  return toDateISO(monday)
}

function getTodayISO(): string {
  return toDateISO(utcToLima(Date.now()))
}

function getWeekRange(mondayISO: string): [string, string] {
  const start = `${mondayISO}T05:00:00Z`                       // Lima Mon 00:00
  const sat   = new Date(mondayISO + 'T12:00:00Z')
  sat.setUTCDate(sat.getUTCDate() + 5)
  const end   = `${toDateISO(sat)}T04:59:59Z`                  // Lima Sat 23:59:59
  return [start, end]
}

function getDayRange(dayISO: string): [string, string] {
  const start = `${dayISO}T05:00:00Z`
  const next  = new Date(dayISO + 'T12:00:00Z')
  next.setUTCDate(next.getUTCDate() + 1)
  const end   = `${toDateISO(next)}T04:59:59Z`
  return [start, end]
}

// ── Shared types (re-exported for client components) ─────────────────────────

export interface CalendarProfessional {
  id:    string
  name:  string
  color: string
}

export interface CalendarAppointment {
  id:                string
  treatment_type:    string
  scheduled_at:      string   // UTC ISO from Supabase
  status:            string
  patient_name:      string
  professional_id:   string | null
  professional_name: string | null
  professional_color: string | null
  duration_min:      number   // real duration from the service catalog (default 60)
}

export interface CalendarSchedule {
  professional_id: string | null
  day_of_week:     number        // 0=Sun 1=Mon … 6=Sat
  start_time:      string        // "HH:MM:SS"
  end_time:        string
}

export interface CalendarBlock {
  id:              string
  professional_id: string | null // null = branch-wide
  block_date:      string        // "YYYY-MM-DD"
  start_time:      string | null // null = full day
  end_time:        string | null
  block_type:      string
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ view?: string; week?: string; day?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const view   = params.view === 'day' ? 'day' : 'week'

  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) redirect('/org-selector')
  const { organizationId, branchId } = ctx

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const weekStartISO = getMondayISO(params.week)
  const dayISO       = (params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day))
    ? params.day
    : getTodayISO()

  const [rangeStart, rangeEnd] = view === 'day'
    ? getDayRange(dayISO)
    : getWeekRange(weekStartISO)

  const [aptsRes, prosRes, schedRes, blocksRes, svcRes] = await Promise.all([
    sb.from('appointments')
      .select('id, treatment_type, scheduled_at, status, professional_id, patients(full_name), professionals(name, color)')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .gte('scheduled_at', rangeStart)
      .lte('scheduled_at', rangeEnd)
      .neq('status', 'cancelled')
      .order('scheduled_at'),
    sb.from('professionals')
      .select('id, name, color')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name'),
    sb.from('doctor_schedules')
      .select('professional_id, day_of_week, start_time, end_time')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId),
    sb.from('schedule_blocks')
      .select('id, professional_id, block_date, start_time, end_time, block_type')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .gte('block_date', view === 'day' ? dayISO : weekStartISO),
    sb.from('services')
      .select('name, duration_min')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId),
  ])

  const svcDuration = new Map<string, number>()
  for (const s of ((svcRes.data ?? []) as { name: string; duration_min: number | null }[])) {
    if (s.duration_min && s.duration_min > 0) svcDuration.set(s.name, s.duration_min)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appointments: CalendarAppointment[] = ((aptsRes.data ?? []) as any[]).map((row) => ({
    id:                row.id,
    treatment_type:    row.treatment_type,
    scheduled_at:      row.scheduled_at,
    status:            row.status,
    patient_name:      row.patients?.full_name ?? '',
    professional_id:   row.professional_id ?? null,
    professional_name: row.professionals?.name ?? null,
    professional_color: row.professionals?.color ?? null,
    duration_min:      svcDuration.get(row.treatment_type) ?? 60,
  }))

  const professionals: CalendarProfessional[] = prosRes.data ?? []
  const schedules: CalendarSchedule[]         = schedRes.data ?? []
  const blocks: CalendarBlock[]               = blocksRes.data ?? []

  if (view === 'day') {
    return (
      <DayCalendar
        appointments={appointments}
        professionals={professionals}
        schedules={schedules}
        blocks={blocks}
        dayISO={dayISO}
        weekStartISO={weekStartISO}
        todayISO={getTodayISO()}
      />
    )
  }

  return (
    <WeeklyCalendar
      appointments={appointments}
      professionals={professionals}
      schedules={schedules}
      blocks={blocks}
      weekStartISO={weekStartISO}
      todayISO={getTodayISO()}
    />
  )
}
