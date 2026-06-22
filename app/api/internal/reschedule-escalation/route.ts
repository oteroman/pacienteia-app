/**
 * /api/internal/reschedule-escalation
 *
 * POST — Scans all branches for reschedule requests pending >2h without slot selection
 *        and creates copilot_tasks so staff can follow up manually.
 *        Idempotent: reminders are moved to status='escalated' after task creation.
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 *
 * Suggested schedule: every hour (e.g. same cadence as appointment-reminders 2h CRON).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { firstNameOf }               from '@/lib/whatsapp/reminders'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  // Find all reminders where patient responded "2" but never picked a slot
  const { data: stale, error } = await sb
    .from('appointment_reminders')
    .select('id, organization_id, branch_id, appointment_id, patient_id, contact_phone, responded_at')
    .eq('status', 'reschedule_requested')
    .not('reschedule_options', 'is', null)
    .lte('responded_at', twoHoursAgo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!stale?.length) return NextResponse.json({ escalated: 0 })

  let escalated = 0
  const results: Array<{ reminderId: string; patientName: string | null; status: 'escalated' | 'failed' }> = []

  for (const reminder of stale as {
    id: string; organization_id: string; branch_id: string
    appointment_id: string; patient_id: string | null
    contact_phone: string; responded_at: string
  }[]) {
    try {
      const [{ data: patient }, { data: apt }] = await Promise.all([
        sb.from('patients').select('full_name').eq('id', reminder.patient_id).single(),
        sb.from('appointments').select('scheduled_at, treatment_type').eq('id', reminder.appointment_id).single(),
      ])

      const firstName   = firstNameOf(patient?.full_name ?? 'Paciente')
      const patientName = patient?.full_name ?? reminder.contact_phone
      const treatment   = apt?.treatment_type ?? 'su cita'

      await sb.from('copilot_tasks').insert({
        organization_id: reminder.organization_id,
        branch_id:       reminder.branch_id,
        patient_id:      reminder.patient_id,
        title:           `📅 Reagendar manualmente: ${firstName} no eligió horario`,
        description:     `${patientName} (${reminder.contact_phone}) solicitó reagendar *${treatment}* pero no seleccionó un nuevo horario en más de 2 horas. Contactar para coordinar manualmente.`,
        priority:        'medium',
        status:          'open',
        source:          'reschedule_escalation',
      })

      // Mark reminder as escalated to prevent duplicate tasks on next CRON run
      await sb.from('appointment_reminders')
        .update({ status: 'escalated' })
        .eq('id', reminder.id)

      results.push({ reminderId: reminder.id, patientName, status: 'escalated' })
      escalated++
    } catch (err) {
      console.error('[reschedule-escalation] failed for reminder', reminder.id, err)
      results.push({ reminderId: reminder.id, patientName: null, status: 'failed' })
    }
  }

  return NextResponse.json({ escalated, total: stale.length, results })
}
