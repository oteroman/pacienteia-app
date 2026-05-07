import { createAdminClient } from '@/lib/supabase/admin'
import { triggerBackfill }   from '@/lib/backfill/index'

// ── Types ─────────────────────────────────────────────────────
export interface GapDay {
  clinicId:     string
  dateLabel:    string   // YYYY-MM-DD (Lima)
  slotStart:    string   // ISO UTC = 10:00 AM Lima of that day
  slotEnd:      string   // ISO UTC = 18:00 Lima of that day
  currentCount: number
  threshold:    number
  topTreatment: string
}

export interface DetectionResult {
  clinicId:  string
  gapsFound: number
  triggered: number   // new slot_openings created
  skipped:   number   // gap days already had an open slot_opening
}

// ── Helpers ───────────────────────────────────────────────────

// Lima is UTC-5 year-round (no DST)
const LIMA_OFFSET_H = 5

function limaDateRange(dayOffset: number): { start: string; end: string; dateLabel: string } {
  const now = new Date()
  // Compute Lima midnight for today, then add dayOffset
  const limaMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + dayOffset,
    LIMA_OFFSET_H, 0, 0, 0,          // midnight Lima = 05:00 UTC
  ))
  const start = limaMidnight.toISOString()
  const end   = new Date(limaMidnight.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const dateLabel = new Date(limaMidnight.getTime() + 1000).toISOString().slice(0, 10)
  return { start, end, dateLabel }
}

function limaSlotAt(dateLabel: string, hour: number): string {
  // e.g., '2026-05-10' + hour 10 → '2026-05-10T15:00:00.000Z' (10AM Lima = 15:00 UTC)
  const [y, m, d] = dateLabel.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, LIMA_OFFSET_H + hour, 0, 0)).toISOString()
}

// ── Core algorithm ────────────────────────────────────────────
export async function detectGapsForClinic(
  clinicId:  string,
  daysAhead = 7,
): Promise<DetectionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = createAdminClient() as any
  const now = new Date()

  // ── 1. Compute avg appointments/day (last 30 days, active only) ──
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentRows } = await sb
    .from('appointments')
    .select('scheduled_at, treatment_type')
    .eq('clinic_id', clinicId)
    .in('status', ['scheduled', 'confirmed', 'completed'])
    .gte('scheduled_at', thirtyDaysAgo)
    .lt('scheduled_at', now.toISOString())
    .is('deleted_at', null)

  const recentAppts  = (recentRows ?? []) as { scheduled_at: string; treatment_type: string }[]
  const avgPerDay    = recentAppts.length / 30

  // Not enough history to set a meaningful threshold — skip
  if (avgPerDay < 0.5) {
    return { clinicId, gapsFound: 0, triggered: 0, skipped: 0 }
  }

  // Threshold: 60% of average (below that = under-density)
  const threshold = Math.max(1, Math.ceil(avgPerDay * 0.6))

  // Top treatment type over last 30 days (used as the candidate search key)
  const treatmentCounts: Record<string, number> = {}
  for (const r of recentAppts) {
    treatmentCounts[r.treatment_type] = (treatmentCounts[r.treatment_type] ?? 0) + 1
  }
  const topTreatment = Object.entries(treatmentCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Consulta'

  // ── 2. Count upcoming appointments per day ───────────────────
  const futureStart = limaDateRange(1).start
  const futureEnd   = limaDateRange(daysAhead + 1).start

  const { data: futureRows } = await sb
    .from('appointments')
    .select('scheduled_at')
    .eq('clinic_id', clinicId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', futureStart)
    .lt('scheduled_at', futureEnd)
    .is('deleted_at', null)

  const countByDay: Record<string, number> = {}
  for (const r of (futureRows ?? []) as { scheduled_at: string }[]) {
    const limaDate = new Date(new Date(r.scheduled_at).getTime() - LIMA_OFFSET_H * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    countByDay[limaDate] = (countByDay[limaDate] ?? 0) + 1
  }

  // ── 3. Identify gap days ─────────────────────────────────────
  const gapDays: GapDay[] = []
  for (let d = 1; d <= daysAhead; d++) {
    const { dateLabel } = limaDateRange(d)
    const count = countByDay[dateLabel] ?? 0
    if (count < threshold) {
      gapDays.push({
        clinicId,
        dateLabel,
        slotStart:    limaSlotAt(dateLabel, 10),   // 10:00 AM Lima
        slotEnd:      limaSlotAt(dateLabel, 18),   // 6:00 PM Lima
        currentCount: count,
        threshold,
        topTreatment,
      })
    }
  }

  if (gapDays.length === 0) {
    return { clinicId, gapsFound: 0, triggered: 0, skipped: 0 }
  }

  // ── 4. Check which gap days are already tracked ──────────────
  const { data: existingRows } = await sb
    .from('slot_openings')
    .select('slot_start')
    .eq('clinic_id', clinicId)
    .eq('reason_opened', 'gap_detected')
    .eq('status', 'open')
    .gte('slot_start', futureStart)
    .lt('slot_start', futureEnd)

  const alreadyTracked = new Set<string>(
    ((existingRows ?? []) as { slot_start: string }[])
      .map((r) => r.slot_start.slice(0, 10)),
  )

  // ── 5. Trigger backfill for new gap days ─────────────────────
  let triggered = 0
  let skipped   = 0

  for (const gap of gapDays) {
    if (alreadyTracked.has(gap.dateLabel)) {
      skipped++
      continue
    }

    const id = await triggerBackfill({
      clinicId:     gap.clinicId,
      appointmentId: null,
      treatmentType: gap.topTreatment,
      slotStart:    gap.slotStart,
      slotEnd:      gap.slotEnd,
      reasonOpened: 'gap_detected',
    })

    if (id) triggered++
    else    skipped++
  }

  return { clinicId, gapsFound: gapDays.length, triggered, skipped }
}
