import { NextRequest, NextResponse }   from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { createAdminClient }          from '@/lib/supabase/admin'
import { getActiveOrganizationId }    from '@/lib/tenant/context'
import { GoogleGenerativeAI }         from '@google/generative-ai'

export async function POST(req: NextRequest) {
  // Verify user session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return NextResponse.json({ error: 'no_org' }, { status: 400 })

  const { conversationId } = await req.json()
  if (!conversationId) return NextResponse.json({ error: 'missing conversationId' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Fetch conversation (validate it belongs to this org)
  const { data: conv } = await sb
    .from('conversations')
    .select('id, contact_name, contact_phone, patient_id')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single()

  if (!conv) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Fetch last 12 messages
  const { data: msgs } = await sb
    .from('messages')
    .select('direction, body, created_at')
    .eq('conversation_id', conversationId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(12)

  const messages: { direction: string; body: string | null }[] =
    ((msgs ?? []) as { direction: string; body: string | null }[]).reverse()

  // Fetch patient info + last appointment (if linked)
  let patientContext = ''
  if (conv.patient_id) {
    const [{ data: patient }, { data: lastApt }] = await Promise.all([
      sb.from('patients')
        .select('full_name, last_visit_date, status')
        .eq('id', conv.patient_id)
        .single(),
      sb.from('appointments')
        .select('treatment_type, scheduled_at, status')
        .eq('patient_id', conv.patient_id)
        .eq('organization_id', organizationId)
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    if (patient) {
      const daysSince = patient.last_visit_date
        ? Math.floor((Date.now() - new Date(patient.last_visit_date).getTime()) / 86_400_000)
        : null
      patientContext = `
Paciente: ${patient.full_name}
Estado: ${patient.status ?? 'activo'}
Última visita: ${daysSince !== null ? `hace ${daysSince} días` : 'sin visitas registradas'}`
    }

    if (lastApt) {
      const aptDate = new Date(lastApt.scheduled_at).toLocaleDateString('es-PE', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
      patientContext += `\nÚltima cita: ${lastApt.treatment_type} — ${aptDate} (${lastApt.status})`
    }
  } else {
    patientContext = `Contacto: ${conv.contact_name ?? conv.contact_phone}`
  }

  // Fetch clinic name
  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  const clinicName = org?.name ?? 'la clínica'

  // Build conversation history for the prompt
  const historyText = messages
    .filter(m => m.body)
    .map(m => `${m.direction === 'inbound' ? 'Paciente' : 'Clínica'}: ${m.body}`)
    .join('\n')

  const prompt = `Eres la recepcionista de ${clinicName}, una clínica en Lima, Perú.
Redacta UNA respuesta breve, amable y en español natural para el paciente.

${patientContext}

Conversación reciente:
${historyText || '(sin mensajes previos)'}

Instrucciones:
- Responde SOLO con el texto del mensaje, sin comillas ni explicaciones
- Máximo 3 oraciones, tono cálido e informal
- Si el paciente quiere agendar: ofrece que te escriba su disponibilidad
- Si el paciente tiene una queja: disculparte y ofrecer solución
- NUNCA menciones diagnósticos, tratamientos médicos ni consejos de salud
- Solo gestión operativa: citas, horarios, información general`

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')

    const genAI  = new GoogleGenerativeAI(apiKey)
    const model  = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME ?? 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const suggestion = result.response.text().trim().replace(/^["']|["']$/g, '')

    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('[suggest-reply]', err)
    return NextResponse.json({ error: 'ai_error' }, { status: 500 })
  }
}
