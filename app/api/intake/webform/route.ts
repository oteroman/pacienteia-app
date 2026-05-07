import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { processIntake }             from '@/app/actions/intake'

// POST /api/intake/webform
// Called by clinic website contact forms.
// Body: { clinic_id, contact_name?, contact_phone?, contact_email?, message }
// Returns: { id } on success
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { clinic_id, contact_name, contact_phone, contact_email, message } = body as {
    clinic_id:     unknown
    contact_name:  unknown
    contact_phone: unknown
    contact_email: unknown
    message:       unknown
  }

  if (typeof clinic_id !== 'string' || typeof message !== 'string' || message.trim().length < 3) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  // Validate clinic exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: clinic } = await sb
    .from('clinics').select('id').eq('id', clinic_id).single()

  if (!clinic) {
    return NextResponse.json({ error: 'clinic_not_found' }, { status: 404 })
  }

  const intakeId = await processIntake({
    clinicId:     clinic_id,
    channel:      'webform',
    contactName:  typeof contact_name  === 'string' ? contact_name  : undefined,
    contactPhone: typeof contact_phone === 'string' ? contact_phone : undefined,
    contactEmail: typeof contact_email === 'string' ? contact_email : undefined,
    rawContent:   message.trim(),
    metadata:     { source: 'webform', origin: req.headers.get('origin') ?? undefined },
  })

  if (!intakeId) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ id: intakeId }, { status: 201 })
}
