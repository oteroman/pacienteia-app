// ROI Report — calculates value delivered by PacienteIA in a given period.
// Used by the weekly CRON to send a summary to the clinic owner via WhatsApp.

import { createAdminClient } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

export interface RoiReport {
  period:             { start: string; end: string; label: string }
  patientsReactivated: number   // reactivation_campaigns responded in period
  flashOffersAccepted: number   // flash_offers accepted
  remindersConfirmed:  number   // appointment_reminders confirmed (no-shows avoided)
  appointmentsBooked:  number   // appointments booked via WhatsApp automation
  revenueEstimatedSoles: number // sum of service prices for completed WA appointments
  avgLeadResponseMin:  number   // avg minutes to first staff response on intakes
}

function weekBounds(weeksAgo = 0): { start: Date; end: Date; label: string } {
  const now  = new Date()
  const lima = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }))
  // Start = Monday of (current - weeksAgo) week
  const day  = lima.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day) - weeksAgo * 7
  const start = new Date(lima)
  start.setDate(lima.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 7 * 24 * 3600_000)
  const label = `${start.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} – ${new Date(end.getTime() - 1).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`
  // Convert to UTC for DB queries (Lima = UTC-5)
  const startUtc = new Date(start.getTime() + 5 * 3600_000)
  const endUtc   = new Date(end.getTime()   + 5 * 3600_000)
  return { start: startUtc, end: endUtc, label }
}

export async function generateRoiReport(opts: {
  organizationId: string
  branchId:       string
  weeksAgo?:      number  // 0 = current week, 1 = last week, etc.
}): Promise<RoiReport> {
  const { organizationId, branchId, weeksAgo = 1 } = opts
  const sb  = createAdminClient() as SB
  const { start, end, label } = weekBounds(weeksAgo)

  const [
    { data: reactivations },
    { data: flashAccepted },
    { data: remindersConf },
    { data: waAppointments },
    { data: intakesRaw },
  ] = await Promise.all([
    // Patients who responded to reactivation in period
    sb.from('reactivation_campaigns')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('status', 'responded')
      .gte('responded_at', start.toISOString())
      .lt('responded_at', end.toISOString()),

    // Flash offers accepted
    sb.from('flash_offers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('status', 'accepted')
      .gte('responded_at', start.toISOString())
      .lt('responded_at', end.toISOString()),

    // Reminders confirmed (patient replied "1" = confirmed)
    sb.from('appointment_reminders')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('status', 'confirmed')
      .gte('confirmed_at', start.toISOString())
      .lt('confirmed_at', end.toISOString()),

    // Appointments booked via WhatsApp automation (booking flow, flash, backfill)
    sb.from('appointments')
      .select('id, price')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .in('source', ['whatsapp_booking', 'whatsapp_flash', 'whatsapp_backfill'])
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString()),

    // Intake response times
    sb.from('intakes')
      .select('created_at, first_contact_at')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .not('first_contact_at', 'is', null)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .limit(100),
  ])

  const revenueEstimated = ((waAppointments ?? []) as { price: number | null }[])
    .reduce((sum, a) => sum + (a.price ?? 0), 0)

  const intakeTimes = (intakesRaw ?? []) as { created_at: string; first_contact_at: string }[]
  const avgResponseMin = intakeTimes.length === 0 ? 0
    : Math.round(
        intakeTimes.reduce((sum, r) => {
          const diff = (new Date(r.first_contact_at).getTime() - new Date(r.created_at).getTime()) / 60_000
          return sum + Math.max(0, diff)
        }, 0) / intakeTimes.length
      )

  return {
    period:              { start: start.toISOString(), end: end.toISOString(), label },
    patientsReactivated:  (reactivations   ?? []).length,
    flashOffersAccepted:  (flashAccepted   ?? []).length,
    remindersConfirmed:   (remindersConf   ?? []).length,
    appointmentsBooked:   (waAppointments  ?? []).length,
    revenueEstimatedSoles: revenueEstimated,
    avgLeadResponseMin:   avgResponseMin,
  }
}

export function buildRoiMessage(report: RoiReport, clinicName: string): string {
  const { period: p, patientsReactivated, flashOffersAccepted, remindersConfirmed, appointmentsBooked, revenueEstimatedSoles, avgLeadResponseMin } = report

  const lines: string[] = [
    `📊 *Reporte semanal PacienteIA*`,
    `_${clinicName} · ${p.label}_`,
    ``,
    `✅ *Citas confirmadas por recordatorio:* ${remindersConfirmed}`,
    `🔄 *Pacientes reactivados:* ${patientsReactivated}`,
    `⚡ *Ofertas flash aceptadas:* ${flashOffersAccepted}`,
    `📅 *Citas agendadas por WhatsApp:* ${appointmentsBooked}`,
  ]

  if (revenueEstimatedSoles > 0) {
    lines.push(`💰 *Revenue generado (est.):* S/ ${revenueEstimatedSoles.toLocaleString('es-PE')}`)
  }

  if (avgLeadResponseMin > 0) {
    const avgLabel = avgLeadResponseMin < 60
      ? `${avgLeadResponseMin} min`
      : `${Math.round(avgLeadResponseMin / 60)}h ${avgLeadResponseMin % 60}min`
    lines.push(`⏱ *Tiempo de respuesta a leads:* ${avgLabel} promedio`)
  }

  const total = patientsReactivated + flashOffersAccepted + remindersConfirmed + appointmentsBooked
  if (total === 0) {
    lines.push(``, `_No hubo actividad automatizada esta semana._`)
  } else {
    lines.push(``, `_PacienteIA trabajó por ti esta semana 💪_`)
  }

  return lines.join('\n')
}
