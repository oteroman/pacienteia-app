import { createClient } from '@/lib/supabase/server'

export interface ReactivationStats {
  contacted: number          // step 1 enviados este mes
  responded: number          // respondieron SÍ
  scheduled: number          // confirmaron cita
  ignored: number            // sin respuesta (step 2 y aún nada)
  response_rate_pct: number  // responded / contacted × 100
  schedule_rate_pct: number  // scheduled / responded × 100
  revenue_recovered: number  // scheduled × ticket_avg (en S/)
}

function pct(num: number, den: number): number {
  if (den === 0) return 0
  return Math.round((num / den) * 100)
}

export async function getReactivationStats(clinicId: string): Promise<ReactivationStats> {
  const supabase = await createClient()

  // Current month window
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: campaigns } = await supabase
    .from('reactivation_campaigns')
    .select('status, step')
    .eq('clinic_id', clinicId)
    .gte('sent_at', monthStart)

  type CampaignRow = { status: string; step: number }
  const rows = (campaigns as CampaignRow[] ?? [])

  // Count by status on step 1 (one entry per patient first contact)
  const step1 = rows.filter((r) => r.step === 1)
  const contacted  = step1.length
  const responded  = rows.filter((r) => r.status === 'responded').length
  const scheduled  = rows.filter((r) => r.status === 'scheduled').length
  const ignored    = rows.filter((r) => r.status === 'ignored').length

  // Get clinic's ticket_avg for revenue estimate
  const { data: clinic } = await supabase
    .from('clinics')
    .select('ticket_avg')
    .eq('id', clinicId)
    .single()

  const ticketAvg = (clinic as { ticket_avg?: number } | null)?.ticket_avg ?? 350
  const revenue_recovered = scheduled * ticketAvg

  return {
    contacted,
    responded,
    scheduled,
    ignored,
    response_rate_pct: pct(responded, contacted),
    schedule_rate_pct: pct(scheduled, responded),
    revenue_recovered,
  }
}
