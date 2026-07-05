import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { processIntake }             from '@/app/actions/intake'

// POST /api/intake/tiktok
// Called by TikTok Lead Generation webhook or manual import.
//
// TikTok Lead Gen payload shape (simplified):
// {
//   "clinic_id": "uuid",          ← added by your TikTok app config or via ad UTM
//   "lead_id": "tt_lead_xxx",
//   "form_name": "Consulta HIFU",
//   "campaign_id": "123",
//   "ad_id": "456",
//   "answers": [
//     { "field_name": "FULL_NAME",    "value": "Ana García" },
//     { "field_name": "PHONE_NUMBER", "value": "+51912345678" },
//     { "field_name": "EMAIL",        "value": "ana@gmail.com" },
//     { "field_name": "CUSTOM_001",   "value": "Interesada en botox y relleno" }
//   ]
// }
//
// For verification handshakes TikTok sends GET with a challenge param.

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('challenge')
  if (challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const {
    clinic_id,
    lead_id,
    form_name,
    campaign_id,
    ad_id,
    answers = [],
  } = body as {
    clinic_id:   unknown
    lead_id:     unknown
    form_name:   unknown
    campaign_id: unknown
    ad_id:       unknown
    answers:     { field_name: string; value: string }[]
  }

  if (typeof clinic_id !== 'string') {
    return NextResponse.json({ error: 'missing_clinic_id' }, { status: 400 })
  }

  // Validate org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: clinic } = await sb.from('organizations').select('id').eq('id', clinic_id).single()
  if (!clinic) {
    return NextResponse.json({ error: 'org_not_found' }, { status: 404 })
  }

  const { data: branch } = await sb
    .from('branches').select('id')
    .eq('organization_id', clinic_id).is('deleted_at', null)
    .order('created_at', { ascending: true }).limit(1).single()

  if (!branch) {
    return NextResponse.json({ error: 'branch_not_configured' }, { status: 422 })
  }

  // Deduplicate by external_id
  if (typeof lead_id === 'string') {
    const { data: existing } = await sb
      .from('intakes')
      .select('id')
      .eq('source_channel', 'tiktok')
      .eq('external_id', lead_id)
      .single()
    if (existing) {
      return NextResponse.json({ id: existing.id, duplicate: true })
    }
  }

  // Extract standard fields from TikTok answers array
  const answerMap = Object.fromEntries(
    (answers as { field_name: string; value: string }[]).map((a) => [a.field_name, a.value])
  )
  const contactName  = answerMap['FULL_NAME']     ?? answerMap['NAME']          ?? null
  const contactPhone = answerMap['PHONE_NUMBER']  ?? answerMap['PHONE']         ?? null
  const contactEmail = answerMap['EMAIL']                                        ?? null
  const customAnswer = Object.entries(answerMap)
    .filter(([k]) => !['FULL_NAME', 'NAME', 'PHONE_NUMBER', 'PHONE', 'EMAIL'].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const rawContent = [
    contactName  && `Nombre: ${contactName}`,
    contactPhone && `Teléfono: ${contactPhone}`,
    contactEmail && `Email: ${contactEmail}`,
    form_name    && `Formulario: ${form_name}`,
    customAnswer || null,
  ].filter(Boolean).join('\n') || 'Lead de TikTok sin datos adicionales'

  const intakeId = await processIntake({
    organizationId: clinic_id,
    branchId:       branch?.id ?? clinic_id,
    channel:        'tiktok',
    externalId:   typeof lead_id === 'string' ? lead_id : undefined,
    contactName:  contactName   ?? undefined,
    contactPhone: contactPhone  ?? undefined,
    contactEmail: contactEmail  ?? undefined,
    rawContent,
    metadata: {
      lead_id,
      form_name,
      campaign_id,
      ad_id,
      answers,
    },
  })

  if (!intakeId) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ id: intakeId }, { status: 201 })
}
