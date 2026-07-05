import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppText }  from '@/lib/whatsapp/send'

const POSITIVE_PATTERNS = /^\s*(s[ií]|dale|claro|va|ok|sí!|si!|me apunto|quiero|acepto|perfecto|confirmo|listo)\s*[!.]*\s*$/i

function isBackfillConfirmation(body: string): boolean {
  return POSITIVE_PATTERNS.test(body.trim())
}

function buildConfirmationMessage(firstName: string, slotLabel: string, clinicName: string): string {
  return (
    `¡Perfecto, ${firstName}! ✅ Tu espacio para *${slotLabel}* ha sido confirmado.\n\n` +
    `Te esperamos en ${clinicName}. Si necesitas cambiar algo, escríbenos. 😊`
  )
}

export async function handleBackfillReply(opts: {
  organizationId: string
  branchId:       string
  contactPhone:   string
  body:           string
}): Promise<boolean> {
  if (!isBackfillConfirmation(opts.body)) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Find an open slot where this phone was notified
  const { data: slot } = await sb
    .from('slot_openings')
    .select('id, treatment_type, slot_start, candidates, notified_phones')
    .eq('organization_id', opts.organizationId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(20)
    .then(({ data }: { data: Record<string, unknown>[] | null }) => ({
      data: (data ?? []).find((s) => {
        const phones = (s.notified_phones as string[]) ?? []
        return phones.includes(opts.contactPhone)
      }) ?? null,
    }))

  if (!slot) return false

  // Find which candidate matches this phone to get patient info
  const candidates = (slot.candidates as { patientId: string; patientName: string; phone: string }[]) ?? []
  const candidate  = candidates.find((c) => c.phone === opts.contactPhone)
  if (!candidate) return false

  // Mark slot filled
  await sb
    .from('slot_openings')
    .update({
      status:             'filled',
      selected_patient_id: candidate.patientId,
      filled_at:          new Date().toISOString(),
      fill_attempts:      1,
    })
    .eq('id', slot.id)
    .eq('organization_id', opts.organizationId)

  // Build a human-readable slot label
  const slotLabel = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(slot.slot_start as string))

  // Fetch clinic name
  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', opts.organizationId)
    .single()
  const clinicName = org?.name ?? 'la clínica'

  const firstName = (candidate.patientName ?? '').split(' ')[0]

  await sendWhatsAppText({
    branchId: opts.branchId,
    to:       opts.contactPhone,
    body:     buildConfirmationMessage(firstName, slotLabel, clinicName),
  })

  return true
}
