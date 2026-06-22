import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient }   from '@/lib/supabase/admin'
import { decryptToken }        from '@/lib/crypto/whatsapp-token'

export interface StaffVoiceTask {
  transcription:      string
  patientName:        string | null
  action:             'schedule' | 'message' | 'task' | 'schedule_and_message'
  dateHint:           string | null
  timeHint:           string | null
  messageToPatient:   string | null
  taskNote:           string
  serviceHint:        string | null
}

const PROMPT = `Eres el asistente operativo de una clínica médica en Lima, Perú.
Un médico o recepcionista te acaba de enviar una nota de voz con instrucciones sobre un paciente.

Transcribe el audio completo y extrae la información estructurada.
Responde SOLO con JSON válido, sin texto adicional:

{
  "transcription": "texto completo del audio transcrito",
  "patient_name": "nombre del paciente mencionado, o null si no se menciona",
  "action": "schedule | message | task | schedule_and_message",
  "date_hint": "cuándo hacer la acción (ej: 'en 15 días', '28 de mayo', 'mañana', 'la próxima semana') o null",
  "time_hint": "hora si se menciona (ej: '10am', '3:30pm') o null",
  "message_to_patient": "qué mensaje enviar al paciente por WhatsApp, redactado de forma amable, o null si no aplica",
  "task_note": "descripción clara de la tarea a crear en el sistema para el equipo",
  "service_hint": "tipo de tratamiento o servicio mencionado (ej: 'botox', 'limpieza facial', 'control') o null"
}

Guía para action:
- schedule: solo agendar cita o control
- message: solo enviar mensaje al paciente
- task: solo crear tarea interna (sin cita ni mensaje)
- schedule_and_message: agendar cita Y enviar mensaje al paciente

Si no queda claro, usa "task".
Responde siempre en español.`

export async function transcribeAndParseVoice(
  mediaId: string,
  branchId: string,
): Promise<StaffVoiceTask | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  // ── 1. Get WhatsApp access token for this branch ──────────────────────────
  const sb = createAdminClient() as any
  const { data: config } = await sb
    .from('branch_whatsapp_config')
    .select('access_token_enc')
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .single() as { data: { access_token_enc: string } | null }

  if (!config) return null

  let token: string
  try {
    token = decryptToken(config.access_token_enc)
  } catch {
    return null
  }

  // ── 2. Resolve media URL from Meta Graph API ──────────────────────────────
  const metaRes = await fetch(
    `https://graph.facebook.com/v20.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!metaRes.ok) {
    const errText = await metaRes.text().catch(() => '')
    console.error('[voice] failed to resolve media URL', metaRes.status, errText)
    return null
  }
  const { url: mediaUrl, mime_type } = await metaRes.json() as {
    url: string
    mime_type: string
  }
  if (!mediaUrl) return null

  // ── 3. Download audio binary ──────────────────────────────────────────────
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!audioRes.ok) {
    console.error('[voice] failed to download audio', audioRes.status)
    return null
  }
  const buffer = await audioRes.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = mime_type ?? 'audio/ogg; codecs=opus'

  // ── 4. Transcribe + extract with Gemini ───────────────────────────────────
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      PROMPT,
    ])

    const text      = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed    = JSON.parse(jsonMatch?.[0] ?? text) as {
      transcription:    string
      patient_name:     string | null
      action:           string
      date_hint:        string | null
      time_hint:        string | null
      message_to_patient: string | null
      task_note:        string
      service_hint:     string | null
    }

    return {
      transcription:    parsed.transcription    ?? '',
      patientName:      parsed.patient_name     ?? null,
      action:           (parsed.action as StaffVoiceTask['action']) ?? 'task',
      dateHint:         parsed.date_hint        ?? null,
      timeHint:         parsed.time_hint        ?? null,
      messageToPatient: parsed.message_to_patient ?? null,
      taskNote:         parsed.task_note        ?? parsed.transcription ?? '',
      serviceHint:      parsed.service_hint     ?? null,
    }
  } catch (err) {
    console.error('[voice] Gemini parse error', err)
    return null
  }
}
