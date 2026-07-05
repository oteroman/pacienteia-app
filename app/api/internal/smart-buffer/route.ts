/**
 * /api/internal/smart-buffer
 *
 * POST — Detects appointments running over time and notifies the next patient.
 *        Logic: if an appointment was scheduled to end more than 10 min ago
 *        and is still in confirmed/scheduled status, the doctor may be running late.
 *        Sends a WhatsApp to the next patient for the same professional.
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 *
 * Body (JSON):
 *   clinic_id  string  UUID (required)
 *   branch_id  string  UUID (required)
 */

import { NextRequest, NextResponse }    from 'next/server'
import { createAdminClient }           from '@/lib/supabase/admin'
import { sendWhatsAppText }            from '@/lib/whatsapp/send'
import { normalizePhonePE, firstNameOf } from '@/lib/whatsapp/reminders'
import { isAutomationEnabled }         from '@/lib/automation/settings'

const LIMA_TZ      = 'America/Lima'
const OVERRUN_MIN  = 10   // minutes past expected end before we consider it a delay
const LOOK_AHEAD_H = 2    // hours ahead to find the next appointment
const DEFAULT_DURATION_MIN = 60

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

function buildDelayMessage(opts: {
  firstName:  string
  delayMin:   number
  clinicName: string
}): string {
  const { firstName, delayMin, clinicName } = opts
  const roundedDelay = Math.ceil(delayMin / 5) * 5  // round up to nearest 5 min
  return (
    `Hola ${firstName} 👋\n\n` +
    `Te escribimos desde *${clinicName}* para informarte que tenemos un pequeño retraso de aproximadamente *${roundedDelay} minutos*.\n\n` +
    `Puedes llegar un poco más tarde sin problema. ¡Gracias por tu comprensión! 🙏`
  )
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body     = await req.json().catch(() => ({}))
  const orgId    = body.clinic_id as string | undefined
  const branchId = body.branch_id as string | undefined

  if (!orgId || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }

  if (!(await isAutomationEnabled(orgId, branchId, 'smart_buffer'))) {
    return NextResponse.json({ skipped: true, reason: 'automation_disabled' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const now       = new Date()
  const lookBack  = new Date(now.getTime() - 4 * 3600_000)   // appointments started up to 4h ago
  const lookAhead = new Date(now.getTime() + LOOK_AHEAD_H * 3600_000)

  // Find appointments that should have ended but are still active
  const { data: potentiallyLate } = await sb
    .from('appointments')
    .select('id, professional_id, scheduled_at, duration_minutes, patient_id')
    .eq('organization_id', orgId)
    .eq('branch_id', branchId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', lookBack.toISOString())
    .lt('scheduled_at', now.toISOString())   // started in the past

  const lateRows = (potentiallyLate ?? []) as {
    id: string
    professional_id: string
    scheduled_at: string
    duration_minutes: number | null
    patient_id: string
  }[]

  let warned = 0

  for (const appt of lateRows) {
    const durationMin   = appt.duration_minutes ?? DEFAULT_DURATION_MIN
    const expectedEndMs = new Date(appt.scheduled_at).getTime() + durationMin * 60_000
    const overrunMs     = now.getTime() - expectedEndMs
    const overrunMin    = Math.floor(overrunMs / 60_000)

    if (overrunMin < OVERRUN_MIN) continue  // not late enough yet

    // Find next appointment for same professional
    const { data: nextAppt } = await sb
      .from('appointments')
      .select('id, patient_id, scheduled_at')
      .eq('organization_id', orgId)
      .eq('branch_id', branchId)
      .eq('professional_id', appt.professional_id)
      .in('status', ['scheduled', 'confirmed'])
      .gt('scheduled_at', now.toISOString())
      .lte('scheduled_at', lookAhead.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!nextAppt) continue

    // Check if we already sent a warning for this pair
    const { data: existingWarn } = await sb
      .from('delay_warnings')
      .select('id')
      .eq('organization_id', orgId)
      .eq('delayed_appointment_id', appt.id)
      .eq('warned_appointment_id', nextAppt.id)
      .limit(1)

    if ((existingWarn ?? []).length > 0) continue

    // Get next patient's phone
    const { data: patient } = await sb
      .from('patients')
      .select('full_name, phone')
      .eq('id', nextAppt.patient_id)
      .single()

    if (!patient?.phone) continue

    const { data: org } = await sb
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    const message = buildDelayMessage({
      firstName:  firstNameOf(patient.full_name),
      delayMin:   overrunMin,
      clinicName: org?.name ?? 'la clínica',
    })

    const result = await sendWhatsAppText({
      branchId,
      to:   normalizePhonePE(patient.phone),
      body: message,
    })

    if (result.error) continue

    await sb.from('delay_warnings').insert({
      organization_id:        orgId,
      branch_id:              branchId,
      delayed_appointment_id: appt.id,
      warned_appointment_id:  nextAppt.id,
      delay_minutes:          overrunMin,
    })

    warned++
  }

  return NextResponse.json({ warned })
}
