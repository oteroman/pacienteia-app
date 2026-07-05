import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppText }  from '@/lib/whatsapp/send'
import { firstNameOf }       from '@/lib/whatsapp/reminders'
import { buildFlashConfirmationMessage } from '@/lib/whatsapp/flash-offers'

const POSITIVE = /^\s*(s[ií]|dale|claro|va|ok|sí!|si!|me apunto|quiero|acepto|perfecto|confirmo|listo)\s*[!.]*\s*$/i

export async function handleFlashOfferReply(opts: {
  organizationId: string
  branchId:       string
  contactPhone:   string
  body:           string
}): Promise<boolean> {
  if (!POSITIVE.test(opts.body.trim())) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Find the most recent open flash offer for this phone, not yet expired
  const { data: offer } = await sb
    .from('flash_offers')
    .select('id, patient_id, professional_id, slot_at, discount_pct')
    .eq('organization_id', opts.organizationId)
    .eq('branch_id', opts.branchId)
    .eq('contact_phone', opts.contactPhone)
    .eq('status', 'sent')
    .gte('expires_at', new Date().toISOString())
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!offer) return false

  // Mark accepted
  await sb
    .from('flash_offers')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', offer.id)

  // Create appointment
  const { data: patient } = await sb
    .from('patients')
    .select('full_name')
    .eq('id', offer.patient_id)
    .single()

  const firstName = firstNameOf(patient?.full_name ?? 'Paciente')

  if (offer.patient_id && offer.professional_id && offer.slot_at) {
    await sb.from('appointments').insert({
      organization_id: opts.organizationId,
      branch_id:       opts.branchId,
      patient_id:      offer.patient_id,
      professional_id: offer.professional_id,
      scheduled_at:    offer.slot_at,
      status:          'confirmed',
      notes:           `Flash offer ${offer.discount_pct}% — reservado via WhatsApp`,
      source:          'whatsapp_flash',
    })
  }

  // Send confirmation
  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', opts.organizationId)
    .single()

  const slotLabel = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(offer.slot_at))

  await sendWhatsAppText({
    branchId: opts.branchId,
    to:       opts.contactPhone,
    body:     buildFlashConfirmationMessage(firstName, slotLabel, org?.name ?? 'la clínica'),
  })

  return true
}
