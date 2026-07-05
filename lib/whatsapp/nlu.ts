import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient }   from '@/lib/supabase/admin'
import { sendWhatsAppText }    from '@/lib/whatsapp/send'
import { startBookingFlow }    from '@/lib/whatsapp/booking-flow'

export type NluIntent =
  | 'cancel_intent'
  | 'reschedule_intent'
  | 'price_inquiry'
  | 'dissatisfaction'
  | 'medical_urgency'
  | 'appointment_request'
  | 'multi_service_interest'
  | 'general_inquiry'
  | 'positive_response'
  | 'none'

export type NluConfidence = 'high' | 'medium' | 'low'

export interface NluResult {
  intent:     NluIntent
  confidence: NluConfidence
  summary:    string
}

const ACTIONABLE: NluIntent[] = [
  'cancel_intent',
  'dissatisfaction',
  'medical_urgency',
  'multi_service_interest',
  // appointment_request is handled separately via booking flow (not a copilot task)
]

const TASK_CONFIG: Record<string, { title: (name: string) => string; priority: string }> = {
  medical_urgency:        { title: (n) => `URGENTE: ${n} reporta emergencia médica`,              priority: 'high' },
  dissatisfaction:        { title: (n) => `${n} está insatisfecho — atención inmediata`,           priority: 'high' },
  cancel_intent:          { title: (n) => `${n} quiere cancelar su cita`,                          priority: 'medium' },
  appointment_request:    { title: (n) => `${n} solicita cita por WhatsApp`,                       priority: 'medium' },
  multi_service_interest: { title: (n) => `Oportunidad cross-selling con ${n} — múltiples servicios`, priority: 'medium' },
}

// Auto-response templates (sent only for medical_urgency and dissatisfaction so staff is aware)
const AUTO_REPLY: Partial<Record<NluIntent, string>> = {
  medical_urgency: '🚨 Hemos recibido tu mensaje. Un miembro de nuestro equipo te contactará en los próximos minutos. Si es una emergencia inmediata, llama al número de urgencias.',
  dissatisfaction: 'Lamentamos mucho tu experiencia. Nuestro equipo revisará tu caso y te contactará muy pronto para resolverlo. Gracias por avisarnos. 🙏',
}

export async function classifyMessage(
  body: string,
  recentMessages: { direction: string; body: string | null }[],
): Promise<NluResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const context = recentMessages
    .filter((m) => m.body)
    .slice(-4)
    .map((m) => `${m.direction === 'inbound' ? 'Paciente' : 'Clínica'}: ${m.body}`)
    .join('\n')

  const prompt = `Analiza este mensaje de WhatsApp de un paciente de una clínica en Lima, Perú.

Contexto reciente:
${context || '(primer mensaje)'}

Mensaje actual: "${body}"

Clasifica la INTENCIÓN PRINCIPAL del mensaje actual. Responde SOLO con JSON válido, sin texto adicional:
{
  "intent": "cancel_intent|reschedule_intent|price_inquiry|dissatisfaction|medical_urgency|appointment_request|multi_service_interest|general_inquiry|positive_response|none",
  "confidence": "high|medium|low",
  "summary": "una frase corta en español que explica la intención"
}

Definiciones:
- cancel_intent: el paciente quiere cancelar su cita
- reschedule_intent: quiere cambiar fecha u hora de su cita
- price_inquiry: pregunta sobre precios, costos o promociones
- dissatisfaction: queja, insatisfacción o mala experiencia
- medical_urgency: dolor intenso, emergencia médica real (NO confundir con preguntas normales)
- appointment_request: quiere agendar una nueva cita
- general_inquiry: pregunta general de información (horarios, servicios, ubicación)
- multi_service_interest: pregunta o menciona interés en 2 o más tratamientos/servicios distintos en el mismo mensaje
- positive_response: confirmación, agradecimiento o respuesta positiva
- none: saludo casual, emoji, mensaje sin intención clara`

  try {
    const genAI  = new GoogleGenerativeAI(apiKey)
    const model  = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME ?? 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text   = result.response.text().trim()

    // Strip markdown code fences if model wraps the JSON
    const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(json) as NluResult
    if (!parsed.intent || !parsed.confidence) return null
    return parsed
  } catch {
    return null
  }
}

export async function runNluPipeline(opts: {
  organizationId: string
  branchId:       string
  conversationId: string
  messageId:      string
  contactPhone:   string
  contactName:    string | null
  body:           string
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Fetch last 4 messages for context
  const { data: history } = await sb
    .from('messages')
    .select('direction, body')
    .eq('conversation_id', opts.conversationId)
    .order('created_at', { ascending: false })
    .limit(5)

  const recentMessages = ((history ?? []) as { direction: string; body: string | null }[]).reverse()

  const nlu = await classifyMessage(opts.body, recentMessages)
  if (!nlu) return

  // Persist intent on the message
  await sb
    .from('messages')
    .update({
      detected_intent:   nlu.intent,
      intent_confidence: nlu.confidence,
      intent_summary:    nlu.summary,
    })
    .eq('id', opts.messageId)

  // Update conversation's last_intent for quick badge in inbox
  if (nlu.intent !== 'none' && nlu.intent !== 'positive_response') {
    await sb
      .from('conversations')
      .update({ last_intent: nlu.intent, last_intent_at: new Date().toISOString() })
      .eq('id', opts.conversationId)
  }

  // Price inquiry: auto-respond with service catalog
  if (nlu.intent === 'price_inquiry' && nlu.confidence !== 'low') {
    await handlePriceInquiry(sb, opts)
    return
  }

  // Appointment request: launch self-booking flow
  if (nlu.intent === 'appointment_request' && nlu.confidence !== 'low') {
    startBookingFlow({
      organizationId: opts.organizationId,
      branchId:       opts.branchId,
      conversationId: opts.conversationId,
      contactPhone:   opts.contactPhone,
      contactName:    opts.contactName,
    }).catch((err) => console.error('[booking-flow start]', err))
    return
  }

  // Only act on actionable intents with high/medium confidence
  if (!ACTIONABLE.includes(nlu.intent)) return
  if (nlu.confidence === 'low') return

  // Find patient_id via conversation
  const { data: conv } = await sb
    .from('conversations')
    .select('patient_id')
    .eq('id', opts.conversationId)
    .single()

  const cfg = TASK_CONFIG[nlu.intent]
  const name = opts.contactName ?? opts.contactPhone

  if (cfg) {
    // Avoid duplicate tasks: don't create if there's already an open one for same conversation + intent
    const { count } = await sb
      .from('copilot_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', opts.organizationId)
      .eq('status', 'open')
      .ilike('description', `%${opts.conversationId}%`)

    if ((count ?? 0) === 0) {
      await sb.from('copilot_tasks').insert({
        organization_id: opts.organizationId,
        branch_id:       opts.branchId,
        patient_id:      conv?.patient_id ?? null,
        title:           cfg.title(name),
        description:     `${nlu.summary}\n\nConversación: ${opts.conversationId}\nTeléfono: ${opts.contactPhone}`,
        priority:        cfg.priority,
        status:          'open',
        source:          'nlu',
      })
    }
  }

  // Auto-reply for emergencies and dissatisfaction (fire & forget)
  const reply = AUTO_REPLY[nlu.intent]
  if (reply && nlu.confidence === 'high') {
    sendWhatsAppText({ branchId: opts.branchId, to: opts.contactPhone, body: reply }).catch(() => {})
  }
}

async function handlePriceInquiry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  opts: { organizationId: string; branchId: string; contactPhone: string },
): Promise<void> {
  const [{ data: services }, { data: org }] = await Promise.all([
    sb.from('services')
      .select('name, price, duration_min')
      .eq('organization_id', opts.organizationId)
      .eq('is_active', true)
      .order('name'),
    sb.from('organizations')
      .select('name')
      .eq('id', opts.organizationId)
      .single(),
  ])

  if (!services || services.length === 0) return

  const clinicName = org?.name ?? 'Nuestra clínica'

  const lines = (services as { name: string; price: number | null; duration_min: number | null }[])
    .map((s) => {
      const price    = s.price != null ? `S/ ${Number(s.price).toFixed(0)}` : 'Consultar'
      const duration = s.duration_min != null ? ` · ${s.duration_min} min` : ''
      return `• *${s.name}*: ${price}${duration}`
    })
    .join('\n')

  const body =
    `Hola! Aquí tienes nuestros servicios y tarifas 😊\n\n` +
    `*${clinicName}*\n\n` +
    lines +
    `\n\n¿Te gustaría agendar una cita? Escríbenos y con gusto te ayudamos.`

  await sendWhatsAppText({ branchId: opts.branchId, to: opts.contactPhone, body })
}
