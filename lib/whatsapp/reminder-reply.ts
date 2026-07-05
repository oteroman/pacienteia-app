// Handles patient replies to appointment reminders (1 = confirm, 2 = reschedule).
// Called from the WhatsApp webhook after every inbound text message.
// Does nothing if the message is not a reminder reply, so it's safe to always call.

import { sendWhatsAppText }        from './send'
import {
  buildConfirmationMessage,
  firstNameOf,
} from './reminders'
import {
  findAvailableSlots,
  buildSlotsMessage,
  buildNoSlotsMessage,
} from './reschedule'
import { sendPaymentRequest }      from '@/lib/payments'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = any

export async function handleReminderReply(opts: {
  sb: SupabaseAdminClient
  organizationId: string
  branchId: string
  contactPhone: string
  body: string
}): Promise<void> {
  const { sb, organizationId, branchId, contactPhone, body } = opts

  const normalized = body.trim().toLowerCase()
  if (normalized !== '1' && normalized !== '2') return

  // Find the most recent sent reminder for this phone + branch
  const { data: reminder } = await sb
    .from('appointment_reminders')
    .select('id, appointment_id, patient_id')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .eq('contact_phone', contactPhone)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  if (!reminder) return  // No pending reminder for this phone, ignore

  // Verify appointment is still in an actionable state
  const { data: apt } = await sb
    .from('appointments')
    .select('id, scheduled_at, status, professional_id, treatment_type')
    .eq('id', reminder.appointment_id)
    .in('status', ['scheduled', 'confirmed'])
    .single()

  if (!apt) return  // Already completed / cancelled, nothing to do

  // Get patient first name, name and clinic name for the response message
  const [{ data: patient }, { data: org }] = await Promise.all([
    sb.from('patients').select('full_name').eq('id', reminder.patient_id).single(),
    sb.from('organizations').select('name').eq('id', organizationId).single(),
  ])

  const patientFirstName = patient ? firstNameOf(patient.full_name) : 'Paciente'
  const clinicName       = org?.name ?? 'la clínica'
  const respondedAt      = new Date().toISOString()

  if (normalized === '1') {
    // Confirm appointment + notify patient
    await Promise.all([
      sb.from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', apt.id),
      sb.from('appointment_reminders')
        .update({ status: 'confirmed', responded_at: respondedAt })
        .eq('id', reminder.id),
    ])

    await sendWhatsAppText({
      branchId,
      to: contactPhone,
      body: buildConfirmationMessage({
        patientFirstName,
        scheduledAt: apt.scheduled_at,
        clinicName,
      }),
    })

    // Fire payment request if the branch has payment configured (fire & forget)
    sendPaymentRequest({
      sb,
      organizationId,
      branchId,
      appointmentId: apt.id,
      contactPhone,
      patientName:   patient?.full_name ?? null,
      serviceName:   apt.treatment_type ?? 'Consulta',
      scheduledAt:   apt.scheduled_at,
    }).catch((err) => console.error('[reminder-reply payment]', err))
  } else {
    // Reschedule requested — find available slots automatically
    let slots: Awaited<ReturnType<typeof findAvailableSlots>> = []

    if (apt.professional_id) {
      slots = await findAvailableSlots({
        sb,
        organizationId,
        branchId,
        professionalId: apt.professional_id,
        durationMin: 60,
        count: 3,
      })
    }

    if (slots.length > 0) {
      await sb.from('appointment_reminders')
        .update({
          status:             'reschedule_requested',
          responded_at:       respondedAt,
          reschedule_options: slots,
        })
        .eq('id', reminder.id)

      await sendWhatsAppText({
        branchId,
        to: contactPhone,
        body: buildSlotsMessage({ patientFirstName, slots, clinicName }),
      })
    } else {
      // No slots found (no schedule configured or all busy) — staff handles
      await sb.from('appointment_reminders')
        .update({ status: 'reschedule_requested', responded_at: respondedAt })
        .eq('id', reminder.id)

      await sendWhatsAppText({
        branchId,
        to: contactPhone,
        body: buildNoSlotsMessage({ patientFirstName, clinicName }),
      })
    }
  }
}
