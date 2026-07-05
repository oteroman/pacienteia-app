/**
 * /api/internal/appointment-reminders
 *
 * GET  — Returns upcoming appointments with pre-formatted messages (for inspection / n8n dry-run).
 * POST — Sends WhatsApp reminders and records them in appointment_reminders.
 *        Idempotent: skips appointments that already have a sent/confirmed reminder of that type.
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 *
 * POST body (JSON):
 *   clinic_id   string  UUID or slug (required)
 *   branch_id   string  UUID (required)
 *   type        string  "24h" | "2h"  (default "24h")
 *   date        string  YYYY-MM-DD Lima time, only for type=24h (default: tomorrow Lima)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { sendWhatsAppText }          from '@/lib/whatsapp/send'
import {
  buildReminderMessage,
  normalizePhonePE,
  firstNameOf,
  type Industry,
} from '@/lib/whatsapp/reminders'

const LIMA_TZ = 'America/Lima'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function tomorrowInLima(): { start: string; end: string; dateLabel: string } {
  const now  = new Date()
  const lima = new Date(now.toLocaleString('en-US', { timeZone: LIMA_TZ }))
  lima.setDate(lima.getDate() + 1)
  lima.setHours(0, 0, 0, 0)
  const dateLabel = lima.toISOString().slice(0, 10)
  const startUTC  = new Date(lima.getTime() + 5 * 60 * 60 * 1000)  // UTC-5
  const endUTC    = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
  return { start: startUTC.toISOString(), end: endUTC.toISOString(), dateLabel }
}

function parseDateInLima(dateStr: string): { start: string; end: string; dateLabel: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const startUTC  = new Date(Date.UTC(y, m - 1, d, 5, 0, 0))  // midnight Lima = 05:00 UTC
  const endUTC    = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
  return { start: startUTC.toISOString(), end: endUTC.toISOString(), dateLabel: dateStr }
}

function next2hWindowUTC(): { start: string; end: string; dateLabel: string } {
  const now = new Date()
  return {
    start:     new Date(now.getTime() +     60 * 60 * 1000).toISOString(),
    end:       new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    dateLabel: now.toISOString().slice(0, 10),
  }
}

// ── GET — dry-run / inspection ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const clinicParam = req.nextUrl.searchParams.get('clinic_id')
  const dateParam   = req.nextUrl.searchParams.get('date')

  if (!clinicParam) {
    return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: clinic } = await sb
    .from('organizations').select('id, name, industry')
    .eq(UUID_RE.test(clinicParam) ? 'id' : 'slug', clinicParam).single()

  if (!clinic) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

  const { start, end, dateLabel } = dateParam ? parseDateInLima(dateParam) : tomorrowInLima()

  const { data: rows, error } = await sb
    .from('appointments')
    .select('id, scheduled_at, treatment_type, branch_id, patients(id, full_name, phone)')
    .eq('organization_id', clinic.id)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string; scheduled_at: string; treatment_type: string; branch_id: string
    patients: { id: string; full_name: string; phone: string | null } | null
  }

  const appointments = (rows as Row[]).map((r) => ({
    id:            r.id,
    scheduledAt:   r.scheduled_at,
    treatmentType: r.treatment_type,
    branchId:      r.branch_id,
    patient: { id: r.patients?.id ?? null, name: r.patients?.full_name ?? 'Paciente', phone: r.patients?.phone ?? null },
    doctorName: null,
    message: buildReminderMessage({
      patientFirstName: firstNameOf(r.patients?.full_name ?? 'Paciente'),
      scheduledAt:      r.scheduled_at,
      doctorFullName:   null,
      clinicName:       clinic.name,
      treatmentType:    r.treatment_type,
      industry:         clinic.industry as Industry,
      reminderType:     '24h',
    }),
  }))

  return NextResponse.json({ date: dateLabel, organizationId: clinic.id, count: appointments.length, appointments })
}

// ── POST — send reminders ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const clinicParam = body.clinic_id as string | undefined
  const branchId    = body.branch_id as string | undefined
  const type        = (body.type as string | undefined) ?? '24h'
  const dateParam   = body.date as string | undefined

  if (!clinicParam || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }
  if (type !== '24h' && type !== '2h') {
    return NextResponse.json({ error: 'type must be "24h" or "2h"' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: clinic } = await sb
    .from('organizations').select('id, name, industry')
    .eq(UUID_RE.test(clinicParam) ? 'id' : 'slug', clinicParam).single()

  if (!clinic) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

  const { start, end, dateLabel } = type === '2h'
    ? next2hWindowUTC()
    : (dateParam ? parseDateInLima(dateParam) : tomorrowInLima())

  const { data: rows, error: fetchErr } = await sb
    .from('appointments')
    .select('id, scheduled_at, treatment_type, patients(id, full_name, phone)')
    .eq('organization_id', clinic.id)
    .eq('branch_id', branchId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  type Row = {
    id: string; scheduled_at: string; treatment_type: string
    patients: { id: string; full_name: string; phone: string | null } | null
  }
  const appointments = rows as Row[]
  if (!appointments.length) {
    return NextResponse.json({ date: dateLabel, type, total: 0, sent: 0, results: [] })
  }

  // Check which appointments already have a non-failed reminder of this type
  const { data: existing } = await sb
    .from('appointment_reminders')
    .select('appointment_id')
    .in('appointment_id', appointments.map((r) => r.id))
    .eq('reminder_type', type)
    .neq('status', 'failed')

  const alreadySent = new Set<string>(((existing ?? []) as { appointment_id: string }[]).map((r) => r.appointment_id))

  const results: Array<{
    appointmentId: string; patient: string | null; phone: string | null
    status: 'sent' | 'failed' | 'skipped'; reason?: string
  }> = []

  for (const apt of appointments) {
    if (alreadySent.has(apt.id)) {
      results.push({ appointmentId: apt.id, patient: apt.patients?.full_name ?? null, phone: null, status: 'skipped', reason: 'already_sent' })
      continue
    }

    const rawPhone = apt.patients?.phone ?? null
    if (!rawPhone) {
      results.push({ appointmentId: apt.id, patient: apt.patients?.full_name ?? null, phone: null, status: 'skipped', reason: 'no_phone' })
      continue
    }

    const phone = normalizePhonePE(rawPhone)
    const message = buildReminderMessage({
      patientFirstName: firstNameOf(apt.patients?.full_name ?? 'Paciente'),
      scheduledAt:      apt.scheduled_at,
      doctorFullName:   null,
      clinicName:       clinic.name,
      treatmentType:    apt.treatment_type,
      industry:         clinic.industry as Industry,
      reminderType:     type,
    })

    const { wamid, error: sendErr } = await sendWhatsAppText({ branchId, to: phone, body: message })

    // Upsert so failed retries overwrite the previous failed record
    await sb.from('appointment_reminders').upsert({
      organization_id: clinic.id,
      branch_id:       branchId,
      appointment_id:  apt.id,
      patient_id:      apt.patients?.id ?? null,
      contact_phone:   phone,
      reminder_type:   type,
      status:          sendErr ? 'failed' : 'sent',
      wamid:           wamid ?? null,
      error_msg:       sendErr ?? null,
      sent_at:         new Date().toISOString(),
    }, { onConflict: 'appointment_id,reminder_type' })

    results.push({
      appointmentId: apt.id,
      patient:       apt.patients?.full_name ?? null,
      phone,
      status:        sendErr ? 'failed' : 'sent',
      reason:        sendErr ?? undefined,
    })
  }

  const sentCount = results.filter((r) => r.status === 'sent').length

  return NextResponse.json({
    date:    dateLabel,
    type,
    total:   appointments.length,
    sent:    sentCount,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed:  results.filter((r) => r.status === 'failed').length,
    results,
  })
}
