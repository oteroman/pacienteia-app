import { createAdminClient } from '@/lib/supabase/admin'

export interface RevenueOpportunity {
  patientId:        string
  patientName:      string
  phone:            string | null
  treatmentType:    string
  lastAptAt:        string
  dueDate:          string
  daysUntilDue:     number
  urgency:          'overdue' | 'this_week' | 'upcoming'
  estimatedRevenue: number | null
}

export async function fetchRevenueOpportunities(
  organizationId: string,
  lookaheadDays = 14,
): Promise<RevenueOpportunity[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = createAdminClient() as any
  const now = new Date()

  // Services that have a retreatment cycle defined
  const { data: services } = await sb
    .from('services')
    .select('name, retreatment_days, price')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .not('retreatment_days', 'is', null)

  if (!services || services.length === 0) return []

  const serviceMap = new Map<string, number>(
    (services as { name: string; retreatment_days: number; price: number | null }[]).map((s) => [s.name, s.retreatment_days]),
  )
  const priceMap = new Map<string, number | null>(
    (services as { name: string; price: number | null }[]).map((s) => [s.name, s.price ?? null]),
  )
  const trackedTypes = Array.from(serviceMap.keys())

  const oneYearAgo = new Date(now.getTime() - 365 * 86_400_000).toISOString()

  // Completed appointments for tracked treatment types in the last year
  const { data: completed } = await sb
    .from('appointments')
    .select('id, patient_id, treatment_type, scheduled_at, patients ( id, full_name, phone )')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .in('treatment_type', trackedTypes)
    .gte('scheduled_at', oneYearAgo)
    .order('scheduled_at', { ascending: false })
    .limit(500)

  if (!completed || completed.length === 0) return []

  // Future appointments for tracked types (to exclude patients already scheduled)
  const { data: future } = await sb
    .from('appointments')
    .select('patient_id, treatment_type')
    .eq('organization_id', organizationId)
    .in('status', ['scheduled', 'confirmed'])
    .in('treatment_type', trackedTypes)
    .gte('scheduled_at', now.toISOString())

  const hasFuture = new Set(
    ((future ?? []) as { patient_id: string; treatment_type: string }[])
      .map((a) => `${a.patient_id}:${a.treatment_type}`),
  )

  // For each patient+treatmentType keep only the most recent completed appointment
  const latestByKey = new Map<string, { patient: { id: string; full_name: string; phone: string | null }; scheduled_at: string }>()
  for (const row of completed as { patient_id: string; treatment_type: string; scheduled_at: string; patients: { id: string; full_name: string; phone: string | null } | null }[]) {
    if (!row.patients) continue
    const key = `${row.patient_id}:${row.treatment_type}`
    if (!latestByKey.has(key)) {
      latestByKey.set(key, { patient: row.patients, scheduled_at: row.scheduled_at })
    }
  }

  const results: RevenueOpportunity[] = []
  const todayMs = now.getTime()

  for (const [key, { patient, scheduled_at }] of latestByKey) {
    const treatmentType = key.split(':').slice(1).join(':')
    const days          = serviceMap.get(treatmentType)
    if (!days) continue
    if (hasFuture.has(key)) continue

    const dueMs       = new Date(scheduled_at).getTime() + days * 86_400_000
    const daysUntil   = Math.floor((dueMs - todayMs) / 86_400_000)

    // Include: overdue (daysUntil < 0) up to lookaheadDays in the future
    if (daysUntil > lookaheadDays) continue
    if (daysUntil < -30) continue // too stale — patient probably dropped off

    const urgency: RevenueOpportunity['urgency'] =
      daysUntil < 0   ? 'overdue' :
      daysUntil <= 7  ? 'this_week' :
      'upcoming'

    results.push({
      patientId:        patient.id,
      patientName:      patient.full_name,
      phone:            patient.phone,
      treatmentType,
      lastAptAt:        scheduled_at,
      dueDate:          new Date(dueMs).toISOString(),
      daysUntilDue:     daysUntil,
      urgency,
      estimatedRevenue: priceMap.get(treatmentType) ?? null,
    })
  }

  return results.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
}
