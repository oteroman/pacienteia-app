/**
 * /api/internal/appointment-followups
 *
 * POST — Encuentra citas atendidas en la ventana de 4-10h y envía
 *         la encuesta de satisfacción por WhatsApp.
 *         Idempotente: omite citas que ya tienen un follow-up.
 *
 * Auth: Bearer CRON_SECRET  o  ?key=ADMIN_DASHBOARD_SECRET
 *
 * Body: { clinic_id, branch_id }
 */

import { NextRequest, NextResponse }  from 'next/server'
import { createAdminClient }          from '@/lib/supabase/admin'
import { sendWhatsAppText }           from '@/lib/whatsapp/send'
import { normalizePhonePE }           from '@/lib/whatsapp/reminders'
import {
  buildFollowupSurveyMessage,
  firstNameOf,
} from '@/lib/whatsapp/followups'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const clinicParam = body.clinic_id as string | undefined
  const branchId    = body.branch_id as string | undefined

  if (!clinicParam || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: clinic } = await sb
    .from('organizations').select('id, name')
    .eq(UUID_RE.test(clinicParam) ? 'id' : 'slug', clinicParam).single()

  if (!clinic) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

  // Window: appointments that completed 4-10h ago (by scheduled_at)
  const now      = new Date()
  const windowEnd   = new Date(now.getTime() - 4  * 60 * 60 * 1000).toISOString()
  const windowStart = new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString()

  const { data: rows, error: fetchErr } = await sb
    .from('appointments')
    .select('id, scheduled_at, treatment_type, patients(id, full_name, phone)')
    .eq('organization_id', clinic.id)
    .eq('branch_id', branchId)
    .eq('status', 'completed')
    .gte('scheduled_at', windowStart)
    .lt('scheduled_at', windowEnd)
    .is('deleted_at', null)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  type Row = {
    id: string; scheduled_at: string; treatment_type: string | null
    patients: { id: string; full_name: string; phone: string | null } | null
  }
  const appointments = (rows ?? []) as Row[]

  if (!appointments.length) {
    return NextResponse.json({ total: 0, sent: 0, results: [] })
  }

  // Find which ones already have a follow-up sent
  const { data: existing } = await sb
    .from('appointment_followups')
    .select('appointment_id')
    .in('appointment_id', appointments.map((r) => r.id))

  const alreadySent = new Set<string>(
    ((existing ?? []) as { appointment_id: string }[]).map((r) => r.appointment_id)
  )

  const results: Array<{
    appointmentId: string; patient: string | null; status: 'sent' | 'failed' | 'skipped'; reason?: string
  }> = []

  for (const apt of appointments) {
    if (alreadySent.has(apt.id)) {
      results.push({ appointmentId: apt.id, patient: apt.patients?.full_name ?? null, status: 'skipped', reason: 'already_sent' })
      continue
    }
    const rawPhone = apt.patients?.phone ?? null
    if (!rawPhone) {
      results.push({ appointmentId: apt.id, patient: apt.patients?.full_name ?? null, status: 'skipped', reason: 'no_phone' })
      continue
    }

    const phone   = normalizePhonePE(rawPhone)
    const message = buildFollowupSurveyMessage({
      patientFirstName: firstNameOf(apt.patients?.full_name ?? 'Paciente'),
      clinicName:       clinic.name,
      treatmentType:    apt.treatment_type,
    })

    const { wamid, error: sendErr } = await sendWhatsAppText({ branchId, to: phone, body: message })

    await sb.from('appointment_followups').upsert({
      organization_id: clinic.id,
      branch_id:       branchId,
      appointment_id:  apt.id,
      patient_id:      apt.patients?.id ?? null,
      contact_phone:   phone,
      status:          sendErr ? 'failed' : 'sent',
      wamid:           wamid ?? null,
      error_msg:       sendErr ?? null,
      sent_at:         now.toISOString(),
    }, { onConflict: 'appointment_id' })

    results.push({
      appointmentId: apt.id,
      patient:       apt.patients?.full_name ?? null,
      status:        sendErr ? 'failed' : 'sent',
      reason:        sendErr ?? undefined,
    })
  }

  const sentCount = results.filter((r) => r.status === 'sent').length

  return NextResponse.json({
    total:   appointments.length,
    sent:    sentCount,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed:  results.filter((r) => r.status === 'failed').length,
    results,
  })
}
