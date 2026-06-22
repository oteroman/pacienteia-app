import { createAdminClient } from '@/lib/supabase/admin'

export type ReputationPeriod = '7d' | '30d' | '90d'

export type ReputationStats = {
  period: { label: string }
  // Encuestas
  followupsSent:       number
  followupsResponded:  number
  responseRate:        number  // %
  avgRating:           number  // 1-5, 0 si sin datos
  // Distribución de ratings
  ratings: { star: number; count: number }[]
  // Escudo de reputación
  reviewLinksSent:     number
  alertsCreated:       number
  // NPS simplificado: promoters (4-5) vs detractors (1-2)
  promoters:           number  // rating 4-5
  passives:            number  // rating 3
  detractors:          number  // rating 1-2
  nps:                 number  // (promoters - detractors) / total * 100
  // Alertas recientes (1-3) para mostrar en tabla
  alerts: AlertRow[]
}

export type AlertRow = {
  id:            string
  patientName:   string
  rating:        number
  scheduledAt:   string
  treatmentType: string | null
  sentAt:        string
  alertCreated:  boolean
}

function periodWindow(p: ReputationPeriod): { start: string; label: string } {
  const days  = p === '7d' ? 7 : p === '30d' ? 30 : 90
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return {
    start: start.toISOString(),
    label: p === '7d' ? 'Últimos 7 días' : p === '30d' ? 'Últimos 30 días' : 'Últimos 90 días',
  }
}

export async function fetchReputationStats(
  organizationId: string,
  branchId: string | null,
  period: ReputationPeriod = '30d',
): Promise<ReputationStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { start, label } = periodWindow(period)

  const base = sb
    .from('appointment_followups')
    .select('id, status, rating, review_link_sent, alert_created, sent_at, patients(full_name), appointments(scheduled_at, treatment_type)')
    .eq('organization_id', organizationId)
    .gte('sent_at', start)
    .order('sent_at', { ascending: false })

  if (branchId) base.eq('branch_id', branchId)

  const { data: rows } = await base

  type Row = {
    id: string; status: string; rating: number | null
    review_link_sent: boolean; alert_created: boolean; sent_at: string
    patients: { full_name: string } | null
    appointments: { scheduled_at: string; treatment_type: string | null } | null
  }
  const all = (rows ?? []) as Row[]

  const followupsSent      = all.length
  const responded          = all.filter((r) => r.status === 'responded' && r.rating !== null)
  const followupsResponded = responded.length
  const responseRate       = followupsSent > 0 ? Math.round((followupsResponded / followupsSent) * 100) : 0

  const ratingSum  = responded.reduce((s, r) => s + (r.rating ?? 0), 0)
  const avgRating  = followupsResponded > 0 ? Math.round((ratingSum / followupsResponded) * 10) / 10 : 0

  const ratings = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: responded.filter((r) => r.rating === star).length,
  }))

  const promoters  = responded.filter((r) => (r.rating ?? 0) >= 4).length
  const passives   = responded.filter((r) => r.rating === 3).length
  const detractors = responded.filter((r) => (r.rating ?? 0) <= 2).length
  const nps        = followupsResponded > 0
    ? Math.round(((promoters - detractors) / followupsResponded) * 100)
    : 0

  const reviewLinksSent = all.filter((r) => r.review_link_sent).length
  const alertsCreated   = all.filter((r) => r.alert_created).length

  // Alertas: seguimientos con rating 1-3
  const alerts: AlertRow[] = responded
    .filter((r) => (r.rating ?? 5) <= 3)
    .slice(0, 20)
    .map((r) => ({
      id:            r.id,
      patientName:   r.patients?.full_name ?? 'Paciente',
      rating:        r.rating ?? 0,
      scheduledAt:   r.appointments?.scheduled_at ?? '',
      treatmentType: r.appointments?.treatment_type ?? null,
      sentAt:        r.sent_at,
      alertCreated:  r.alert_created,
    }))

  return {
    period: { label },
    followupsSent, followupsResponded, responseRate,
    avgRating, ratings,
    reviewLinksSent, alertsCreated,
    promoters, passives, detractors, nps,
    alerts,
  }
}
