import { createClient } from '@/lib/supabase/server'

export interface ReputationStats {
  total_sent: number
  avg_score: number          // 1.0 – 5.0
  positive_count: number     // score 4-5
  negative_count: number     // score 1-3
  positive_pct: number       // positive / total × 100
  google_reviews_sent: number
  alerts_sent: number
  // Weekly trend: last 4 weeks avg score
  weekly_trend: { week: string; avg: number }[]
}

export async function getReputationStats(clinicId: string): Promise<ReputationStats> {
  const supabase = await createClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: rows } = await supabase
    .from('patient_feedback')
    .select('score, google_review_sent, alert_sent, created_at')
    .eq('clinic_id', clinicId)
    .gte('created_at', monthStart)

  type FeedbackRow = { score: number; google_review_sent: boolean; alert_sent: boolean; created_at: string }
  const feedback = (rows as FeedbackRow[] ?? [])
  const total = feedback.length
  const positive = feedback.filter((r) => r.score >= 4)
  const negative = feedback.filter((r) => r.score <= 3)
  const avgScore =
    total === 0 ? 0 : Math.round((feedback.reduce((s, r) => s + r.score, 0) / total) * 10) / 10

  // Weekly trend (last 4 weeks)
  const weekly_trend: { week: string; avg: number }[] = []
  for (let i = 3; i >= 0; i--) {
    const start = new Date()
    start.setDate(start.getDate() - (i + 1) * 7)
    const end = new Date()
    end.setDate(end.getDate() - i * 7)

    const weekRows = feedback.filter((r) => {
      const d = new Date(r.created_at)
      return d >= start && d < end
    })

    const weekAvg =
      weekRows.length === 0
        ? 0
        : Math.round((weekRows.reduce((s, r) => s + r.score, 0) / weekRows.length) * 10) / 10

    weekly_trend.push({
      week: `Sem ${4 - i}`,
      avg: weekAvg,
    })
  }

  return {
    total_sent: total,
    avg_score: avgScore,
    positive_count: positive.length,
    negative_count: negative.length,
    positive_pct: total === 0 ? 0 : Math.round((positive.length / total) * 100),
    google_reviews_sent: feedback.filter((r) => r.google_review_sent).length,
    alerts_sent: feedback.filter((r) => r.alert_sent).length,
    weekly_trend,
  }
}
