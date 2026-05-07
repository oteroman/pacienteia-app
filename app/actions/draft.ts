'use server'

import Anthropic             from '@anthropic-ai/sdk'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchIntake, CHANNEL_LABELS, INTENT_LABELS } from '@/lib/intake/index'
import { fetchClinicProfile, TONE_LLM_HINT } from '@/lib/clinic/profile'

const client = new Anthropic()

export async function generateDraft(intakeId: string): Promise<string> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return ''

  const [intake, profile] = await Promise.all([
    fetchIntake(clinicId, intakeId),
    fetchClinicProfile(clinicId),
  ])
  if (!intake) return ''

  const toneHint = profile ? TONE_LLM_HINT[profile.brandTone] : TONE_LLM_HINT['professional']

  const systemPrompt = [
    `Eres un asistente de comunicación para clínicas estéticas en Lima, Perú.`,
    `Redacta solo el texto del mensaje de respuesta, en primera persona del plural ("nosotros").`,
    `Tono: ${toneHint}.`,
    profile?.brandToneNotes ? `Instrucciones adicionales de estilo: ${profile.brandToneNotes}.` : null,
    profile?.brandName ? `La clínica se llama "${profile.brandName}".` : null,
    profile?.businessHours ? `Horario de atención: ${profile.businessHours}.` : null,
    `En español. Sin explicaciones, sin comillas.`,
    `El mensaje debe ser corto (máximo 3 oraciones) y terminar con una pregunta o CTA concreto.`,
    `NO incluyas firma — se agrega por separado.`,
  ].filter(Boolean).join(' ')

  const ctx = [
    `Canal: ${CHANNEL_LABELS[intake.sourceChannel]}`,
    `Intención: ${intake.detectedIntent ? INTENT_LABELS[intake.detectedIntent] : 'general'}`,
    `Prioridad: ${intake.priority}`,
    intake.contactName  ? `Nombre: ${intake.contactName}`  : null,
    intake.contactPhone ? `Teléfono: ${intake.contactPhone}` : null,
    `Mensaje:\n${intake.rawContent.slice(0, 600)}`,
    intake.normalizedSummary ? `Resumen: ${intake.normalizedSummary}` : null,
  ].filter(Boolean).join('\n')

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: ctx }],
    })

    return message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
  } catch {
    return ''
  }
}
