/**
 * /api/internal/abandonment-prediction
 *
 * POST — Analyzes recent WhatsApp conversation tone per patient and assigns an
 *        abandonment risk score 0-100.  Patients scoring >65 get a copilot task.
 *        Designed to run weekly (Sunday night, Lima time).
 *
 * Auth: Bearer CRON_SECRET  or  ?key=ADMIN_DASHBOARD_SECRET
 *
 * Body (JSON):
 *   clinic_id   string  UUID (required)
 *   branch_id   string  UUID (required)
 *   limit       number  max patients per run (default 30, max 100)
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI }        from '@google/generative-ai'
import { createAdminClient }         from '@/lib/supabase/admin'

const RISK_THRESHOLD = 65   // above this → copilot task

function isAuthorized(req: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET
  const adminSecret = process.env.ADMIN_DASHBOARD_SECRET
  const bearer = req.headers.get('authorization')
  const key    = req.nextUrl.searchParams.get('key')
  return (!!cronSecret  && bearer === `Bearer ${cronSecret}`) ||
         (!!adminSecret && key    === adminSecret)
}

async function scorePatientMessages(
  messages: { direction: string; body: string | null }[],
  patientName: string,
): Promise<{ score: number; reasoning: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const transcript = messages
    .filter((m) => m.body)
    .map((m) => `${m.direction === 'inbound' ? 'Paciente' : 'Clínica'}: ${m.body}`)
    .join('\n')

  if (!transcript.trim()) return null

  const prompt = `Analiza esta conversación de WhatsApp entre una clínica en Lima, Perú y el paciente "${patientName}".

Conversación (más reciente abajo):
${transcript}

Determina el riesgo de abandono del paciente (que deje de asistir a la clínica).
Responde SOLO con JSON válido, sin texto adicional:
{
  "abandonment_risk": <número entero del 0 al 100>,
  "reasoning": "<frase corta en español explicando el score>"
}

Criterios para el score:
- 0-30: paciente satisfecho, comprometido, responde bien
- 31-60: señales neutras o leves de desenganche
- 61-80: señales claras de insatisfacción o distancia (respuestas frías, demoras, quejas)
- 81-100: alta probabilidad de abandono (cancelaciones, quejas directas, tono hostil, desinterés marcado)`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME ?? 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text   = result.response.text().trim()
    const json   = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(json) as { abandonment_risk: number; reasoning: string }
    return { score: Math.min(100, Math.max(0, Number(parsed.abandonment_risk))), reasoning: parsed.reasoning }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body     = await req.json().catch(() => ({}))
  const orgId    = body.clinic_id as string | undefined
  const branchId = body.branch_id as string | undefined
  const limit    = Math.min(Number(body.limit ?? 30), 100)

  if (!orgId || !branchId) {
    return NextResponse.json({ error: 'clinic_id and branch_id are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Patients with at least one message in the last 30 days (excluding those without phone)
  const cutoff30 = new Date()
  cutoff30.setDate(cutoff30.getDate() - 30)

  const { data: conversations } = await sb
    .from('conversations')
    .select('id, patient_id, contact_phone, contact_name')
    .eq('organization_id', orgId)
    .eq('branch_id', branchId)
    .not('patient_id', 'is', null)
    .gte('last_message_at', cutoff30.toISOString())
    .order('last_message_at', { ascending: false })
    .limit(limit)

  const convRows = (conversations ?? []) as {
    id: string
    patient_id: string
    contact_phone: string
    contact_name: string | null
  }[]

  let scored = 0, tasked = 0, skipped = 0

  for (const conv of convRows) {
    // Get last 10 messages for this conversation
    const { data: msgs } = await sb
      .from('messages')
      .select('direction, body')
      .eq('conversation_id', conv.id)
      .not('body', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const messages = ((msgs ?? []) as { direction: string; body: string | null }[]).reverse()
    if (messages.length < 3) { skipped++; continue }

    const patientName = conv.contact_name ?? conv.contact_phone
    const prediction  = await scorePatientMessages(messages, patientName)
    if (!prediction) { skipped++; continue }

    // Update patient record
    await sb
      .from('patients')
      .update({
        abandonment_risk:    prediction.score,
        abandonment_risk_at: new Date().toISOString(),
      })
      .eq('id', conv.patient_id)
      .eq('organization_id', orgId)

    scored++

    if (prediction.score >= RISK_THRESHOLD) {
      // Create copilot task only if no open one exists for same patient
      const { count } = await sb
        .from('copilot_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('patient_id', conv.patient_id)
        .eq('status', 'open')
        .eq('source', 'abandonment_prediction')

      if ((count ?? 0) === 0) {
        await sb.from('copilot_tasks').insert({
          organization_id: orgId,
          branch_id:       branchId,
          patient_id:      conv.patient_id,
          title:           `Riesgo de abandono detectado: ${patientName} (score ${prediction.score})`,
          description:     `${prediction.reasoning}\n\nTeléfono: ${conv.contact_phone}`,
          priority:        prediction.score >= 80 ? 'high' : 'medium',
          status:          'open',
          source:          'abandonment_prediction',
        })
        tasked++
      }
    }
  }

  return NextResponse.json({ scored, tasked, skipped })
}
