/**
 * POST /api/webhooks/appointment-reply
 *
 * Called by n8n's IF node after a patient replies to the WhatsApp reminder.
 * Updates appointment status and returns the confirmation/cancellation message
 * for n8n to send back to the patient.
 *
 * Auth: x-webhook-secret header matching WEBHOOK_SECRET env var
 *
 * Body:
 *   appointment_id  — UUID of the appointment
 *   response        — 'ok' | 'cancel'  (case-insensitive, also accepts 'cancelar', 'yes', 'si', 'sí')
 *   workflow_run_id — optional, links this reply to the sender run for audit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { triggerRebooking }          from '@/lib/rebooking/index'
import { triggerBackfill }           from '@/lib/backfill/index'

const OK_TOKENS     = new Set(['ok', 'yes', 'si', 'sí', 'confirmar', 'confirmo', 'confirm'])
const CANCEL_TOKENS = new Set(['cancel', 'cancelar', 'cancelo', 'no'])

function classifyResponse(raw: string): 'confirmed' | 'cancelled' | null {
  const token = raw.trim().toLowerCase()
  if (OK_TOKENS.has(token))     return 'confirmed'
  if (CANCEL_TOKENS.has(token)) return 'cancelled'
  return null
}

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-webhook-secret')
  return !!process.env.WEBHOOK_SECRET && secret === process.env.WEBHOOK_SECRET
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { appointment_id, response, workflow_run_id } = body as {
    appointment_id?:  string
    response?:        string
    workflow_run_id?: string
  }

  if (!appointment_id || !response) {
    return NextResponse.json({ error: 'appointment_id and response are required' }, { status: 400 })
  }

  const newStatus = classifyResponse(response)
  if (!newStatus) {
    return NextResponse.json({
      error:   'unrecognized_response',
      hint:    'Valid values: ok, si, yes, cancel, cancelar',
      received: response,
    }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const now = new Date().toISOString()

  // Fetch appointment to verify it exists and get clinic_id + patient data
  const { data: appt } = await sb
    .from('appointments')
    .select('id, clinic_id, status, treatment_type, scheduled_at, patient_id, patients ( full_name, phone )')
    .eq('id', appointment_id)
    .is('deleted_at', null)
    .single()

  if (!appt) {
    return NextResponse.json({ error: 'appointment_not_found' }, { status: 404 })
  }

  if (appt.status === 'cancelled' || appt.status === 'confirmed') {
    return NextResponse.json({
      appointmentId: appointment_id,
      status:        appt.status,
      alreadySet:    true,
      replyMessage:  null,
    })
  }

  // Update status
  await sb.from('appointments').update({ status: newStatus, updated_at: now }).eq('id', appointment_id)

  // Build reply message for n8n to send back to patient
  const patientName = appt.patients?.full_name ?? 'Paciente'
  const replyMessage = newStatus === 'confirmed'
    ? `Perfecto ${patientName} ✅ Tu cita de ${appt.treatment_type} está confirmada. ¡Nos vemos mañana!`
    : `Entendido ${patientName}. Tu cita ha sido cancelada. Para reagendar escríbenos cuando gustes. 😊`

  // On cancellation: trigger rebooking (same patient) + backfill (find replacement)
  if (newStatus === 'cancelled') {
    triggerRebooking({
      clinicId:       appt.clinic_id,
      appointmentId:  appointment_id,
      patientId:      appt.patient_id ?? null,
      patientName,
      patientPhone:   appt.patients?.phone ?? null,
      treatmentType:  appt.treatment_type,
      scheduledAt:    appt.scheduled_at,
      triggerType:    'cancelled',
      previousStatus: appt.status,
      rebookReason:   'Paciente canceló via WhatsApp',
    }).catch(() => {})

    triggerBackfill({
      clinicId:      appt.clinic_id,
      appointmentId: appointment_id,
      treatmentType: appt.treatment_type,
      slotStart:     appt.scheduled_at,
      reasonOpened:  'cancellation',
    }).catch(() => {})
  }

  // Log to workflow_runs
  await sb.from('workflow_runs').insert({
    clinic_id:    appt.clinic_id,
    event_type:   'appointment_reply',
    entity_type:  'appointment',
    entity_id:    appointment_id,
    status:       'success',
    payload:      { response, workflow_run_id: workflow_run_id ?? null },
    result:       { newStatus, patientName },
    completed_at: now,
  }).then(() => {}).catch(() => {})

  return NextResponse.json({
    appointmentId: appointment_id,
    status:        newStatus,
    replyMessage,
  })
}
