import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/types/database'

// Receives lead events from external sources (n8n, WhatsApp integrations, web forms)
// Requires header: x-webhook-secret matching WEBHOOK_SECRET env var
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clinic_id, source, phone, message } = body as {
    clinic_id?: string
    source?: string
    phone?: string
    message?: string
  }

  if (!clinic_id || !phone) {
    return NextResponse.json({ error: 'clinic_id and phone are required' }, { status: 400 })
  }

  const supabase = await createClient()

  const leadData: TablesInsert<'lead_events'> = {
    clinic_id,
    event_type: 'lead.created',
    source: source ?? 'web',
    payload: { phone, message: message ?? '', channel: source ?? 'web' },
    processed: false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('lead_events').insert(leadData).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
