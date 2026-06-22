import { createAdminClient }        from '@/lib/supabase/admin'
import { sendWhatsAppText }          from '@/lib/whatsapp/send'
import { isPositiveReply, buildReactivationConfirmation } from '@/lib/whatsapp/reactivation-messages'

export async function handleReactivationReply(opts: {
  organizationId: string
  branchId:       string
  contactPhone:   string
  body:           string
}): Promise<void> {
  if (!isPositiveReply(opts.body)) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Find the most recent open reactivation campaign for this phone
  const { data: campaign } = await sb
    .from('reactivation_campaigns')
    .select('id, patient_id, step')
    .eq('organization_id', opts.organizationId)
    .eq('contact_phone', opts.contactPhone)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  if (!campaign) return

  // Mark as responded
  await sb
    .from('reactivation_campaigns')
    .update({ status: 'responded', responded_at: new Date().toISOString() })
    .eq('id', campaign.id)

  // Get patient name and clinic name for the confirmation message
  const [{ data: patient }, { data: org }] = await Promise.all([
    sb.from('patients').select('full_name').eq('id', campaign.patient_id).single(),
    sb.from('organizations').select('name').eq('id', opts.organizationId).single(),
  ])

  const patientFullName = patient?.full_name ?? 'Paciente'
  const clinicName      = org?.name ?? 'la clínica'

  // Send confirmation
  await sendWhatsAppText({
    branchId: opts.branchId,
    to:       opts.contactPhone,
    body:     buildReactivationConfirmation({ patientFullName, clinicName }),
  })

  // Create copilot task so staff knows to follow up
  await sb.from('copilot_tasks').insert({
    organization_id: opts.organizationId,
    patient_id:      campaign.patient_id,
    interaction_id:  null,
    title:           `Agendar cita — ${patientFullName} respondió a campaña de reactivación`,
    description:     `El paciente respondió positivamente al mensaje de reactivación (paso ${campaign.step}). Contactar para confirmar horario.`,
    priority:        'high',
    status:          'open',
    source:          'reactivation',
  })
}
