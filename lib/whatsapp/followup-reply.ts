import { createAdminClient }        from '@/lib/supabase/admin'
import { sendWhatsAppText }         from './send'
import {
  buildReviewThankyouMessage,
  buildAlertThankyouMessage,
  firstNameOf,
} from './followups'

const RATING_RE = /^\s*([1-5])\s*$/

export async function handleFollowupReply(opts: {
  organizationId: string
  branchId:       string
  contactPhone:   string
  body:           string
}): Promise<void> {
  const { organizationId, branchId, contactPhone, body } = opts

  const match = RATING_RE.exec(body.trim())
  if (!match) return

  const rating = parseInt(match[1], 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Find a pending follow-up for this phone in this branch
  const { data: followup } = await sb
    .from('appointment_followups')
    .select('id, patient_id, appointment_id, review_link_sent, alert_created')
    .eq('contact_phone', contactPhone)
    .eq('branch_id', branchId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  if (!followup) return

  // Mark responded immediately (idempotency)
  await sb
    .from('appointment_followups')
    .update({ status: 'responded', rating, responded_at: new Date().toISOString() })
    .eq('id', followup.id)

  // Fetch patient name and clinic info
  const [{ data: patient }, { data: org }, { data: config }] = await Promise.all([
    sb.from('patients').select('full_name').eq('id', followup.patient_id).single(),
    sb.from('organizations').select('name').eq('id', organizationId).single(),
    sb.from('branch_whatsapp_config')
      .select('google_review_url')
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .single(),
  ])

  const firstName  = firstNameOf(patient?.full_name ?? 'Paciente')
  const clinicName = org?.name ?? 'la clínica'
  const googleUrl  = config?.google_review_url ?? null

  if (rating >= 4 && googleUrl && !followup.review_link_sent) {
    // Happy patient — send Google Review link
    const msg = buildReviewThankyouMessage({ patientFirstName: firstName, clinicName, rating, googleReviewUrl: googleUrl })
    await sendWhatsAppText({ branchId, to: contactPhone, body: msg })
    await sb.from('appointment_followups').update({ review_link_sent: true }).eq('id', followup.id)

  } else if (rating >= 4 && !googleUrl) {
    // Happy but no review URL configured — just thank them
    const msg = `¡Muchas gracias, ${firstName}! Nos alegra que hayas tenido una experiencia excelente. ¡Hasta la próxima! ❤️ — *${clinicName}*`
    await sendWhatsAppText({ branchId, to: contactPhone, body: msg })

  } else if (rating <= 3 && !followup.alert_created) {
    // Unhappy patient — thank + create internal alert
    const msg = buildAlertThankyouMessage({ patientFirstName: firstName, clinicName })
    await sendWhatsAppText({ branchId, to: contactPhone, body: msg })

    // Create a copilot task so staff sees it immediately
    await sb.from('copilot_tasks').insert({
      organization_id: organizationId,
      branch_id:       branchId,
      title:           `⚠️ Alerta de reputación: ${firstName} calificó ${rating}/5`,
      description:     `El paciente ${patient?.full_name ?? contactPhone} calificó su atención con ${rating}/5 en la encuesta post-cita. Requiere seguimiento inmediato.`,
      priority:        'high',
      status:          'pending',
      source:          'reputation_alert',
    })

    await sb.from('appointment_followups').update({ alert_created: true }).eq('id', followup.id)
  }
}
