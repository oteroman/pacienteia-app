import Anthropic from '@anthropic-ai/sdk'
import type { IntakeIntent, IntakePriority } from './index'

export interface NormalizeResult {
  normalizedSummary: string
  detectedIntent:    IntakeIntent
  priority:          IntakePriority
  suggestedTask:     { title: string; description: string; priority: IntakePriority } | null
}

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres un asistente de recepción para clínicas estéticas en Lima, Perú.
Analiza el mensaje o contacto entrante y extrae información estructurada.

Responde SOLO con JSON válido, sin texto adicional:
{
  "normalizedSummary": "Resumen en 1 oración de qué quiere el contacto",
  "detectedIntent": "uno de: lead_inquiry | appointment_request | followup | urgent | general",
  "priority": "high | medium | low",
  "suggestedTask": null o { "title": "...", "description": "...", "priority": "high|medium|low" }
}

Guías para intent:
- lead_inquiry: persona nueva consultando precios, tratamientos, disponibilidad
- appointment_request: quiere agendar o reagendar una cita específica
- followup: paciente existente con preguntas post-tratamiento o resultados
- urgent: dolor, reacción adversa, queja grave, emergencia
- general: consulta genérica sin acción clara

Guías para priority:
- high: urgencias, citas para hoy/mañana, quejas, leads muy calificados
- medium: leads normales, citas próxima semana, seguimientos pendientes
- low: consultas informativas, sin fecha, sin urgencia

suggestedTask: créala solo si hay una acción concreta que el staff debe tomar
Responde siempre en español`

export async function normalizeIntake(rawContent: string): Promise<NormalizeResult> {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: rawContent }],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  try {
    const parsed = JSON.parse(text) as NormalizeResult
    return {
      normalizedSummary: parsed.normalizedSummary ?? rawContent.slice(0, 200),
      detectedIntent:    parsed.detectedIntent    ?? 'general',
      priority:          parsed.priority          ?? 'medium',
      suggestedTask:     parsed.suggestedTask     ?? null,
    }
  } catch {
    return {
      normalizedSummary: rawContent.slice(0, 200),
      detectedIntent:    'general',
      priority:          'medium',
      suggestedTask:     null,
    }
  }
}
