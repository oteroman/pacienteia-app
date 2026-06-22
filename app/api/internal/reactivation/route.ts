/**
 * /api/internal/reactivation
 *
 * POST — Sends WhatsApp reactivation messages to inactive patients.
 *        Idempotent: skips patients already contacted in last 30 days.
 *        Step 1: warm message to patients inactive 90+ days.
 *        Step 2: follow-up to step-1 patients with no response after 7 days.
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 *
 * POST body (JSON):
 *   clinic_id   string  UUID (required)
 *   branch_id   string  UUID (required)
 *   step        number  1 | 2  (default 1)
 *   limit       number  max patients per run (default 20, max 50)
 */

import { NextRequest, NextResponse }    from 'next/server'
import { createAdminClient }            from '@/lib/supabase/admin'
import { sendWhatsAppText }             from '@/lib/whatsapp/send'
import { normalizePhonePE, firstNameOf } from '@/lib/whatsapp/reminders'
import {
  buildReactivationStep1,
  buildReactivationStep2,
} from '@/lib/whatsapp/reactivation-messages'

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

  const body = await req.json().catch(() => ({}))
  const orgId    = body.clinic_id as string | undefined
  const branchId = body.branch_id as string | undefined
  const step     = Number(body.step ?? 1) as 1 | 2
  const limit    = Math.min(Number(body.limit ?? 20), 50)

  if (!orgId || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Get clinic name for messages
  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()
  const clinicName = org?.name ?? 'la clínica'

  let sent = 0, skipped = 0
  const errors: string[] = []

  if (step === 1) {
    // ── Step 1: inactive 90+ days, never recently contacted ──────────────────
    const cutoff90 = new Date()
    cutoff90.setDate(cutoff90.getDate() - 90)

    const cutoff30 = new Date()
    cutoff30.setDate(cutoff30.getDate() - 30)

    // Patients already in any campaign last 30 days
    const { data: recentCampaigns } = await sb
      .from('reactivation_campaigns')
      .select('patient_id')
      .eq('organization_id', orgId)
      .gte('sent_at', cutoff30.toISOString())

    const excludeIds = ((recentCampaigns ?? []) as { patient_id: string }[]).map((r) => r.patient_id)

    // Patients with a future appointment
    const { data: withFuture } = await sb
      .from('appointments')
      .select('patient_id')
      .eq('organization_id', orgId)
      .gt('scheduled_at', new Date().toISOString())
      .in('status', ['scheduled', 'confirmed'])

    const futureIds = ((withFuture ?? []) as { patient_id: string }[]).map((r) => r.patient_id)

    const allExclude = [...new Set([...excludeIds, ...futureIds])]

    let query = sb
      .from('patients')
      .select('id, full_name, phone')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .lte('last_visit_date', cutoff90.toISOString().split('T')[0])
      .not('phone', 'is', null)
      .not('status', 'in', '("blocked","lead")')
      .order('last_visit_date', { ascending: true })
      .limit(limit)

    if (allExclude.length > 0) {
      query = query.not('id', 'in', `(${allExclude.join(',')})`)
    }

    const { data: patients } = await query
    const rows = (patients ?? []) as { id: string; full_name: string; phone: string }[]

    for (const p of rows) {
      const contactPhone = normalizePhonePE(p.phone)
      const message = buildReactivationStep1({
        patientFullName: p.full_name,
        clinicName,
      })

      const result = await sendWhatsAppText({ branchId, to: contactPhone, body: message })

      if (result.error) {
        errors.push(`${firstNameOf(p.full_name)}: ${result.error}`)
        skipped++
        continue
      }

      await sb.from('reactivation_campaigns').upsert({
        organization_id: orgId,
        branch_id:       branchId,
        patient_id:      p.id,
        step:            1,
        status:          'sent',
        contact_phone:   contactPhone,
        sent_at:         new Date().toISOString(),
      }, { onConflict: 'organization_id,patient_id,step', ignoreDuplicates: true })

      sent++
    }

  } else {
    // ── Step 2: step-1 patients with no response after 7 days ────────────────
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: step1Rows } = await sb
      .from('reactivation_campaigns')
      .select('id, patient_id, contact_phone')
      .eq('organization_id', orgId)
      .eq('step', 1)
      .eq('status', 'sent')
      .lte('sent_at', sevenDaysAgo.toISOString())
      .limit(limit)

    const candidates = (step1Rows ?? []) as { id: string; patient_id: string; contact_phone: string }[]
    if (candidates.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, step: 2 })
    }

    // Exclude those who already have step 2
    const patientIds = candidates.map((r) => r.patient_id)
    const { data: existingStep2 } = await sb
      .from('reactivation_campaigns')
      .select('patient_id')
      .eq('organization_id', orgId)
      .eq('step', 2)
      .in('patient_id', patientIds)

    const alreadyStep2 = new Set(((existingStep2 ?? []) as { patient_id: string }[]).map((r) => r.patient_id))

    for (const c of candidates) {
      if (alreadyStep2.has(c.patient_id)) { skipped++; continue }

      const { data: patient } = await sb
        .from('patients')
        .select('full_name')
        .eq('id', c.patient_id)
        .single()

      const message = buildReactivationStep2({
        patientFullName: patient?.full_name ?? 'Paciente',
        clinicName,
      })

      const result = await sendWhatsAppText({ branchId, to: c.contact_phone, body: message })

      if (result.error) {
        errors.push(`patient ${c.patient_id}: ${result.error}`)
        skipped++
        continue
      }

      await sb.from('reactivation_campaigns').insert({
        organization_id: orgId,
        branch_id:       branchId,
        patient_id:      c.patient_id,
        step:            2,
        status:          'sent',
        contact_phone:   c.contact_phone,
        sent_at:         new Date().toISOString(),
      })

      sent++
    }
  }

  return NextResponse.json({ sent, skipped, step, errors: errors.length ? errors : undefined })
}
