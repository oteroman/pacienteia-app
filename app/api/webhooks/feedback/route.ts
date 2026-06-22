// POST /api/webhooks/feedback
// Called by n8n after receiving the patient's satisfaction score.
// Saves to patient_feedback and flags alert if score <= 3.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function authorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-webhook-secret')
  return !!process.env.WEBHOOK_SECRET && secret === process.env.WEBHOOK_SECRET
}

type FeedbackBody = {
  organization_id: string
  patient_id?: string
  appointment_id?: string
  score: number              // 1-5
  channel?: string
  google_review_sent?: boolean
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: FeedbackBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Accept both org_id (new) and clinic_id (legacy n8n compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBody = body as any
  const organization_id = body.organization_id ?? rawBody.clinic_id
  const { patient_id, appointment_id, score, channel, google_review_sent } = body

  if (!organization_id || score == null) {
    return NextResponse.json({ error: 'organization_id and score are required' }, { status: 400 })
  }
  if (score < 1 || score > 5) {
    return NextResponse.json({ error: 'score must be between 1 and 5' }, { status: 400 })
  }

  const isNegative = score <= 3
  const googleSent = !isNegative && (google_review_sent ?? false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data, error } = await supabase.from('patient_feedback').insert({
    organization_id,
    patient_id:         patient_id ?? null,
    appointment_id:     appointment_id ?? null,
    score,
    channel:            channel ?? 'whatsapp',
    google_review_sent: googleSent,
    alert_sent:         isNegative,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    { id: data.id, alert_triggered: isNegative, google_review_sent: googleSent },
    { status: 201 }
  )
}
