/**
 * GET /api/internal/appointment-reminders
 *
 * Called by n8n at 8 AM America/Lima each day.
 * Returns tomorrow's scheduled appointments with pre-formatted WhatsApp message per patient.
 * n8n loops over the result, sends each message, then calls /api/webhooks/appointment-reply
 * with the patient's response.
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 * Query params:
 *   clinic_id  — UUID or slug (required)
 *   date       — YYYY-MM-DD in Lima time (optional, defaults to tomorrow Lima)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'

const LIMA_TZ = 'America/Lima'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

function tomorrowInLima(): { start: string; end: string; dateLabel: string } {
  const now   = new Date()
  const lima  = new Date(now.toLocaleString('en-US', { timeZone: LIMA_TZ }))
  lima.setDate(lima.getDate() + 1)
  lima.setHours(0, 0, 0, 0)

  const dateLabel = lima.toISOString().slice(0, 10)

  // Convert midnight Lima → UTC for the DB query
  const start = new Date(lima.toLocaleString('en-US', { timeZone: 'UTC' }))
  // Lima is UTC-5, so midnight Lima = 05:00 UTC
  const offsetMs = 5 * 60 * 60 * 1000
  const startUTC = new Date(lima.getTime() + offsetMs)
  const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)

  void start
  return {
    start:     startUTC.toISOString(),
    end:       endUTC.toISOString(),
    dateLabel,
  }
}

function parseDateInLima(dateStr: string): { start: string; end: string; dateLabel: string } {
  // dateStr is YYYY-MM-DD in Lima time
  const [y, m, d] = dateStr.split('-').map(Number)
  // Midnight Lima = midnight + 5h UTC
  const startUTC = new Date(Date.UTC(y, m - 1, d, 5, 0, 0))
  const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
  return { start: startUTC.toISOString(), end: endUTC.toISOString(), dateLabel: dateStr }
}

function formatTimeLima(isoUtc: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA_TZ,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(isoUtc))
}

function buildWhatsAppMessage(
  patientName: string,
  timeFormatted: string,
  doctorName: string | null,
  treatmentType: string,
): string {
  const doctor = doctorName ? `Dr. ${doctorName}` : 'nuestro equipo'
  return (
    `Hola ${patientName} 👋 Te recordamos tu cita de *${treatmentType}* ` +
    `mañana a las *${timeFormatted}* con ${doctor}.\n\n` +
    `Responde *OK* para confirmar o *CANCELAR* si necesitas otro horario.`
  )
}

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

  // Resolve org by UUID or slug
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isUUID = uuidPattern.test(clinicParam)
  const { data: clinic } = await sb.from('organizations').select('id, name').eq(isUUID ? 'id' : 'slug', clinicParam).single()

  if (!clinic) {
    return NextResponse.json({ error: 'org_not_found' }, { status: 404 })
  }

  const { start, end, dateLabel } = dateParam ? parseDateInLima(dateParam) : tomorrowInLima()

  // Fetch tomorrow's scheduled appointments with patient + doctor data
  const { data: rows, error } = await sb
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      treatment_type,
      assigned_staff_id,
      patients ( id, full_name, phone ),
      profiles:assigned_staff_id ( full_name )
    `)
    .eq('organization_id', clinic.id)
    .eq('status', 'scheduled')
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type AppRow = {
    id: string
    scheduled_at: string
    treatment_type: string
    assigned_staff_id: string | null
    patients: { id: string; full_name: string; phone: string | null } | null
    profiles: { full_name: string | null } | null
  }

  const appointments = (rows as AppRow[]).map((r) => {
    const timeFormatted = formatTimeLima(r.scheduled_at)
    const patientName   = r.patients?.full_name ?? 'Paciente'
    const doctorName    = r.profiles?.full_name ?? null
    return {
      id:            r.id,
      scheduledAt:   r.scheduled_at,
      timeFormatted,
      treatmentType: r.treatment_type,
      patient: {
        id:    r.patients?.id ?? null,
        name:  patientName,
        phone: r.patients?.phone ?? null,
      },
      doctorName,
      message: buildWhatsAppMessage(patientName, timeFormatted, doctorName, r.treatment_type),
    }
  })

  return NextResponse.json({
    date:          dateLabel,
    organizationId: clinic.id,
    organizationName: clinic.name,
    count:         appointments.length,
    appointments,
  })
}
