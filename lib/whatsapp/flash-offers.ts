// Flash Offers: detect empty slots in next 24-48h and send targeted discount offers.
// When a slot is open, we notify up to 2 inactive patients with a WhatsApp offer.

import { createAdminClient }    from '@/lib/supabase/admin'
import { sendWhatsAppText }     from '@/lib/whatsapp/send'
import { findAvailableSlots }   from '@/lib/whatsapp/reschedule'
import { normalizePhonePE, firstNameOf } from '@/lib/whatsapp/reminders'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

const LIMA_TZ    = 'America/Lima'
const MAX_PER_SLOT = 2   // max patients notified per slot

function limaDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: LIMA_TZ })
}

// Returns Lima midnight UTC for a given Lima date string (YYYY-MM-DD)
function limaDateToUtc(dateStr: string): Date {
  const [y, m, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day, 5, 0, 0)) // Lima = UTC-5
}

// Tomorrow in Lima time (as YYYY-MM-DD)
export function tomorrowLima(): string {
  const now  = new Date()
  const lima = new Date(now.toLocaleString('en-US', { timeZone: LIMA_TZ }))
  lima.setDate(lima.getDate() + 1)
  return lima.toLocaleDateString('en-CA')
}

export function buildFlashOfferMessage(opts: {
  firstName:   string
  slotLabel:   string
  clinicName:  string
  discountPct: number
}): string {
  const { firstName, slotLabel, clinicName, discountPct } = opts
  return (
    `¡Hola ${firstName}! 👋\n\n` +
    `Tenemos un espacio *libre para mañana: ${slotLabel}* y nos gustaría ofrecértelo.\n\n` +
    `¿Te interesa agendarte con un *${discountPct}% de descuento*? La oferta es solo válida por hoy. 🎁\n\n` +
    `👉 Responde *SÍ* para reservarlo ahora.\n\n` +
    `— ${clinicName}`
  )
}

export function buildFlashConfirmationMessage(firstName: string, slotLabel: string, clinicName: string): string {
  return (
    `¡Perfecto, ${firstName}! ✅ Tu cita para *${slotLabel}* ha sido confirmada con el descuento.\n\n` +
    `Te esperamos en *${clinicName}*. Si necesitas cambiar algo, escríbenos 😊`
  )
}

function formatSlotLabel(isoStr: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA_TZ,
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(isoStr))
}

// Find patients to notify for a given professional's slot.
// Prefers patients who have visited before (same branch), are inactive 30+ days,
// and haven't received a flash offer in the last 7 days.
async function findCandidates(opts: {
  sb:             SB
  organizationId: string
  branchId:       string
  professionalId: string
  slotAt:         string
  limit:          number
}): Promise<{ patientId: string; fullName: string; phone: string }[]> {
  const { sb, organizationId, branchId, professionalId, limit } = opts

  const cutoff30 = new Date()
  cutoff30.setDate(cutoff30.getDate() - 30)

  const cutoffFlash7 = new Date()
  cutoffFlash7.setDate(cutoffFlash7.getDate() - 7)

  // Patients already notified by flash offer in last 7 days
  const { data: recentFlash } = await sb
    .from('flash_offers')
    .select('patient_id')
    .eq('organization_id', organizationId)
    .gte('sent_at', cutoffFlash7.toISOString())

  const flashExclude = new Set<string>(
    ((recentFlash ?? []) as { patient_id: string }[]).map((r) => r.patient_id)
  )

  // Patients with a future appointment (no need to flash-offer them)
  const { data: withFuture } = await sb
    .from('appointments')
    .select('patient_id')
    .eq('organization_id', organizationId)
    .gt('scheduled_at', new Date().toISOString())
    .in('status', ['scheduled', 'confirmed'])

  const futureExclude = new Set<string>(
    ((withFuture ?? []) as { patient_id: string }[]).map((r) => r.patient_id)
  )

  // Patients in active reactivation (last 30 days)
  const { data: recentReact } = await sb
    .from('reactivation_campaigns')
    .select('patient_id')
    .eq('organization_id', organizationId)
    .gte('sent_at', cutoff30.toISOString())

  const reactExclude = new Set<string>(
    ((recentReact ?? []) as { patient_id: string }[]).map((r) => r.patient_id)
  )

  const allExclude = [...new Set([...flashExclude, ...futureExclude, ...reactExclude])]

  // Prefer patients who have seen this professional before and are inactive 30+ days
  let query = sb
    .from('patients')
    .select('id, full_name, phone')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .lte('last_visit_date', cutoff30.toISOString().split('T')[0])
    .not('phone', 'is', null)
    .not('status', 'in', '("blocked","lead")')
    .order('last_visit_date', { ascending: false })
    .limit(limit * 3)  // fetch more to filter client-side

  if (allExclude.length > 0) {
    query = query.not('id', 'in', `(${allExclude.join(',')})`)
  }

  const { data: patients } = await query
  const rows = (patients ?? []) as { id: string; full_name: string; phone: string }[]

  // Prioritize patients who have seen this professional
  const { data: prevAppts } = await sb
    .from('appointments')
    .select('patient_id')
    .eq('organization_id', organizationId)
    .eq('professional_id', professionalId)
    .order('scheduled_at', { ascending: false })
    .limit(100)

  const prevPatientIds = new Set<string>(
    ((prevAppts ?? []) as { patient_id: string }[]).map((r) => r.patient_id)
  )

  const preferred = rows.filter((p) => prevPatientIds.has(p.id)).slice(0, limit)
  const others    = rows.filter((p) => !prevPatientIds.has(p.id)).slice(0, limit - preferred.length)
  const candidates = [...preferred, ...others].slice(0, limit)

  return candidates.map((p) => ({
    patientId: p.id,
    fullName:  p.full_name,
    phone:     normalizePhonePE(p.phone),
  }))
}

// Main entry point: find open slots for all professionals in a branch and send offers.
export async function sendFlashOffers(opts: {
  organizationId: string
  branchId:       string
  discountPct?:   number
  targetDate?:    string   // YYYY-MM-DD Lima; defaults to tomorrow
}): Promise<{ sent: number; skipped: number; slots: number }> {
  const { organizationId, branchId, discountPct = 20 } = opts
  const targetDate = opts.targetDate ?? tomorrowLima()

  const sb = createAdminClient() as SB

  const [{ data: org }, { data: professionals }] = await Promise.all([
    sb.from('organizations').select('name').eq('id', organizationId).single(),
    sb.from('professionals')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('is_active', true),
  ])

  const clinicName = org?.name ?? 'la clínica'
  const profs = (professionals ?? []) as { id: string; name: string }[]

  let sent = 0, skipped = 0, slotsFound = 0

  // Target window: the entire target date in Lima time
  const targetStartUtc = limaDateToUtc(targetDate)
  const targetEndUtc   = new Date(targetStartUtc.getTime() + 24 * 3600_000)

  for (const prof of profs) {
    // Get all available slots for this professional in next 3 days
    const slots = await findAvailableSlots({
      sb,
      organizationId,
      branchId,
      professionalId: prof.id,
      durationMin:    60,
      count:          10,
    })

    // Filter to slots that fall on targetDate in Lima time
    const tomorrowSlots = slots.filter((s) => {
      const slotMs = new Date(s.utcIso).getTime()
      return slotMs >= targetStartUtc.getTime() && slotMs < targetEndUtc.getTime()
    })

    if (tomorrowSlots.length === 0) continue

    // Take first open slot for this professional
    const slot = tomorrowSlots[0]
    slotsFound++

    // Check if we already sent flash offers for this slot today
    const { data: existing } = await sb
      .from('flash_offers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('professional_id', prof.id)
      .eq('slot_at', slot.utcIso)
      .limit(1)

    if ((existing ?? []).length > 0) { skipped++; continue }

    const candidates = await findCandidates({
      sb,
      organizationId,
      branchId,
      professionalId: prof.id,
      slotAt:         slot.utcIso,
      limit:          MAX_PER_SLOT,
    })

    if (candidates.length === 0) { skipped++; continue }

    const slotLabel  = formatSlotLabel(slot.utcIso)
    const expiresAt  = new Date(targetStartUtc.getTime() + 20 * 3600_000).toISOString() // expires end of day

    for (const candidate of candidates) {
      const firstName = firstNameOf(candidate.fullName)
      const message   = buildFlashOfferMessage({ firstName, slotLabel, clinicName, discountPct })
      const result    = await sendWhatsAppText({ branchId, to: candidate.phone, body: message })

      if (result.error) { skipped++; continue }

      await sb.from('flash_offers').insert({
        organization_id: organizationId,
        branch_id:       branchId,
        professional_id: prof.id,
        patient_id:      candidate.patientId,
        contact_phone:   candidate.phone,
        slot_at:         slot.utcIso,
        discount_pct:    discountPct,
        status:          'sent',
        expires_at:      expiresAt,
      })

      sent++
    }
  }

  return { sent, skipped, slots: slotsFound }
}
