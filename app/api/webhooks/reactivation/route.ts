// POST /api/webhooks/reactivation
// Called by n8n when a patient responds (or is marked ignored after step 2).
// Updates campaign status and optionally updates patient.status.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/types/database'

function authorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-webhook-secret')
  return !!process.env.WEBHOOK_SECRET && secret === process.env.WEBHOOK_SECRET
}

type ReactivationBody = {
  clinic_id: string
  patient_id: string
  step: 1 | 2
  // action: what n8n determined from the patient's reply
  action: 'responded' | 'scheduled' | 'ignored' | 'create_step1' | 'create_step2'
  notes?: string
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ReactivationBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clinic_id, patient_id, step, action, notes } = body
  if (!clinic_id || !patient_id || !action) {
    return NextResponse.json({ error: 'clinic_id, patient_id, action required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // CREATE: n8n creates a new campaign entry when it sends a message
  if (action === 'create_step1' || action === 'create_step2') {
    const insertData: TablesInsert<'reactivation_campaigns'> = {
      clinic_id,
      patient_id,
      step: action === 'create_step1' ? 1 : 2,
      status: 'sent',
      sent_at: new Date().toISOString(),
      notes: notes ?? null,
    }
    const { data, error } = await supabase.from('reactivation_campaigns').insert(insertData).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id }, { status: 201 })
  }

  // UPDATE: patient responded, scheduled, or ignored
  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = { status: action }
  if (action === 'responded') updatePayload.responded_at = now
  if (action === 'scheduled') {
    updatePayload.responded_at = now
    updatePayload.scheduled_at = now
  }
  if (notes) updatePayload.notes = notes

  const { error: updateErr } = await supabase
    .from('reactivation_campaigns')
    .update(updatePayload)
    .eq('clinic_id', clinic_id)
    .eq('patient_id', patient_id)
    .eq('step', step)
    .eq('status', 'sent')

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // If patient responded, mark them as active
  if (action === 'responded' || action === 'scheduled') {
    await supabase
      .from('patients')
      .update({ status: 'active' })
      .eq('id', patient_id)
      .eq('status', 'inactive')
  }

  return NextResponse.json({ ok: true })
}
