// ============================================================
// PacienteIA — Reactivación Pro: query de pacientes inactivos
// Esta lógica vive en el app, no en n8n. n8n solo consume
// el endpoint /api/internal/reactivation/patients
// ============================================================

import { createClient } from '@/lib/supabase/server'

export interface InactivePatient {
  id: string
  full_name: string
  phone: string | null
  last_visit_date: string | null
  days_inactive: number
}

/**
 * Returns patients inactive for 90+ days, filtered by:
 * - not blocked, not lead
 * - no future appointment
 * - not already contacted in the last 30 days
 * - limited to `limit` (default 50 for Pro plan)
 */
export async function getInactivePatients(
  clinicId: string,
  limit = 50
): Promise<InactivePatient[]> {
  const supabase = await createClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffISO = cutoff.toISOString().split('T')[0]

  // Patients with a future appointment
  const { data: withFuture } = await supabase
    .from('appointments')
    .select('patient_id')
    .eq('clinic_id', clinicId)
    .gt('scheduled_at', new Date().toISOString())
    .in('status', ['scheduled', 'confirmed'])

  const withFutureIds = (withFuture as { patient_id: string }[] ?? []).map((r) => r.patient_id)

  // Patients already in a campaign in the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentCampaigns } = await supabase
    .from('reactivation_campaigns')
    .select('patient_id')
    .eq('clinic_id', clinicId)
    .gte('sent_at', thirtyDaysAgo.toISOString())
    .in('status', ['sent', 'responded'])

  const recentIds = (recentCampaigns as { patient_id: string }[] ?? []).map((r) => r.patient_id)

  const excludeIds = [...new Set([...withFutureIds, ...recentIds])]

  let query = supabase
    .from('patients')
    .select('id, full_name, phone, last_visit_date')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .not('status', 'in', '("blocked","lead")')
    .lte('last_visit_date', cutoffISO)
    .not('phone', 'is', null)
    .order('last_visit_date', { ascending: true })
    .limit(limit)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.map((id) => `"${id}"`).join(',')})`)
  }

  const { data } = await query

  type PatientRow = { id: string; full_name: string; phone: string | null; last_visit_date: string | null }
  const today = new Date()
  return ((data as unknown as PatientRow[]) ?? []).map((p) => {
    const last = p.last_visit_date ? new Date(p.last_visit_date) : null
    const days = last ? Math.floor((today.getTime() - last.getTime()) / 86_400_000) : 999
    return {
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      last_visit_date: p.last_visit_date,
      days_inactive: days,
    }
  })
}

/**
 * Patients in step 1 (sent) for more than 7 days — candidates for step 2
 */
export async function getPendingStep2Patients(clinicId: string): Promise<string[]> {
  const supabase = await createClient()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data } = await supabase
    .from('reactivation_campaigns')
    .select('patient_id')
    .eq('clinic_id', clinicId)
    .eq('step', 1)
    .eq('status', 'sent')
    .lte('sent_at', sevenDaysAgo.toISOString())

  // Exclude those who already have a step 2
  const patientIds = (data as { patient_id: string }[] ?? []).map((r) => r.patient_id)
  if (patientIds.length === 0) return []

  const { data: step2Existing } = await supabase
    .from('reactivation_campaigns')
    .select('patient_id')
    .eq('clinic_id', clinicId)
    .eq('step', 2)
    .in('patient_id', patientIds)

  const alreadyStep2 = new Set((step2Existing as { patient_id: string }[] ?? []).map((r) => r.patient_id))
  return patientIds.filter((id) => !alreadyStep2.has(id))
}
