export interface RetentionStats {
  totalAppointments: number
  noShows: number
  daysSinceLastAppointment: number | null
  hasFutureAppointment: boolean
  lastWasNoShow: boolean
}

export interface RetentionScore {
  score: number
  label: string
  badgeCls: string
  barCls: string
}

export function calculateRetentionScore(stats: RetentionStats): RetentionScore {
  if (stats.totalAppointments === 0) {
    return { score: 0, label: 'Sin historial', badgeCls: 'bg-gray-100 text-gray-400', barCls: 'bg-gray-300' }
  }

  let s = 100

  // Recency penalty
  const d = stats.daysSinceLastAppointment
  if (d !== null) {
    if (d > 120) s -= 45
    else if (d > 90) s -= 30
    else if (d > 60) s -= 20
    else if (d > 30) s -= 10
  }

  // Future appointment bonus (patient is actively engaged)
  if (stats.hasFutureAppointment) s += 15

  // No-show rate penalty
  const rate = stats.noShows / stats.totalAppointments
  if (rate > 0.5) s -= 35
  else if (rate > 0.25) s -= 20
  else if (rate > 0.10) s -= 10
  else if (rate > 0) s -= 5

  // Extra penalty if last appointment was a no-show
  if (stats.lastWasNoShow) s -= 10

  // Loyalty depth bonus
  if (stats.totalAppointments >= 6) s += 10
  else if (stats.totalAppointments >= 3) s += 5

  const score = Math.max(0, Math.min(100, s))

  if (score >= 80) return { score, label: 'Fiel',       badgeCls: 'bg-green-100 text-green-700',  barCls: 'bg-green-500' }
  if (score >= 60) return { score, label: 'Estable',    badgeCls: 'bg-sky-100 text-sky-700',      barCls: 'bg-sky-500' }
  if (score >= 40) return { score, label: 'En riesgo',  badgeCls: 'bg-amber-100 text-amber-700',  barCls: 'bg-amber-500' }
  return                   { score, label: 'Riesgo alto', badgeCls: 'bg-red-100 text-red-700',   barCls: 'bg-red-500' }
}

interface RawApt { status: string; scheduled_at: string }

export function buildRetentionStats(appointments: RawApt[]): RetentionStats {
  const now    = Date.now()
  const past   = appointments.filter(a => new Date(a.scheduled_at).getTime() <= now)
  const future = appointments.some(a => new Date(a.scheduled_at).getTime() > now)
  const sorted = [...past].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  )
  const last = sorted[0]
  return {
    totalAppointments:        past.length,
    noShows:                  past.filter(a => a.status === 'no_show').length,
    daysSinceLastAppointment: last
      ? Math.floor((now - new Date(last.scheduled_at).getTime()) / 86_400_000)
      : null,
    hasFutureAppointment:     future,
    lastWasNoShow:            last?.status === 'no_show',
  }
}
