/**
 * /api/webhooks/niubiz
 *
 * Receives payment confirmation callbacks from Niubiz after a patient pays
 * via a "Cobro con Link" payment link.
 *
 * Niubiz POSTs JSON with purchaseNumber + transactionStatus.
 * We match on payment_order_id in appointments, update payment_status to 'paid',
 * and send a WhatsApp confirmation to the patient.
 */

import { NextRequest, NextResponse }  from 'next/server'
import { createAdminClient }          from '@/lib/supabase/admin'
import { sendWhatsAppText }           from '@/lib/whatsapp/send'
import { firstNameOf, formatWeekdayDayLima, formatTimeLima } from '@/lib/whatsapp/reminders'

interface NiubizWebhookPayload {
  purchaseNumber:     string
  transactionStatus:  string   // 'Authorized' | 'Denied' | 'Error'
  amount?:            number
  currency?:          string
  authorizationCode?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: NiubizWebhookPayload
  try {
    payload = await req.json() as NiubizWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!payload.purchaseNumber) {
    return NextResponse.json({ error: 'missing purchaseNumber' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: apt } = await sb
    .from('appointments')
    .select('id, organization_id, branch_id, patient_id, treatment_type, scheduled_at, payment_status')
    .eq('payment_order_id', payload.purchaseNumber)
    .single()

  if (!apt) {
    return NextResponse.json({ error: 'appointment_not_found' }, { status: 404 })
  }

  if (payload.transactionStatus === 'Authorized') {
    if (apt.payment_status === 'paid') {
      return NextResponse.json({ ok: true, note: 'already_paid' })
    }

    await sb
      .from('appointments')
      .update({
        payment_status:  'paid',
        payment_paid_at: new Date().toISOString(),
        status:          'confirmed',
      })
      .eq('id', apt.id)

    // Fetch patient phone + name to send confirmation
    const [{ data: patient }, { data: org }, { data: conv }] = await Promise.all([
      apt.patient_id
        ? sb.from('patients').select('full_name, phone').eq('id', apt.patient_id).single()
        : Promise.resolve({ data: null }),
      sb.from('organizations').select('name').eq('id', apt.organization_id).single(),
      sb.from('conversations')
        .select('contact_phone')
        .eq('organization_id', apt.organization_id)
        .eq('branch_id', apt.branch_id)
        .eq('patient_id', apt.patient_id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    const contactPhone = conv?.contact_phone ?? patient?.phone
    if (contactPhone) {
      const firstName  = firstNameOf(patient?.full_name ?? contactPhone)
      const clinicName = org?.name ?? 'la clínica'
      const day        = formatWeekdayDayLima(apt.scheduled_at)
      const time       = formatTimeLima(apt.scheduled_at)

      await sendWhatsAppText({
        branchId: apt.branch_id,
        to:       contactPhone,
        body:
          `✅ ¡Pago recibido, ${firstName}! Tu separación de *S/ ${payload.amount ?? ''}* fue confirmada.\n\n` +
          `Tu cita de *${apt.treatment_type}* está asegurada para el *${day}* a las *${time}* en *${clinicName}*. ¡Te esperamos! 😊`,
      })
    }

    return NextResponse.json({ ok: true })
  }

  if (payload.transactionStatus === 'Denied' || payload.transactionStatus === 'Error') {
    await sb
      .from('appointments')
      .update({ payment_status: 'expired' })
      .eq('id', apt.id)

    return NextResponse.json({ ok: true, note: 'payment_failed' })
  }

  return NextResponse.json({ ok: true, note: 'status_ignored' })
}
