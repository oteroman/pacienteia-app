import { GoogleGenerativeAI } from '@google/generative-ai'
import type { IntakeIntent, IntakePriority } from './index'

export interface NormalizeResult {
  normalizedSummary: string
  detectedIntent:    IntakeIntent
  priority:          IntakePriority
  suggestedTask:     { title: string; description: string; priority: IntakePriority } | null
}

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
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      normalizedSummary: rawContent.slice(0, 200),
      detectedIntent:    'general',
      priority:          'medium',
      suggestedTask:     null,
    }
  }

  try {
    const genAI  = new GoogleGenerativeAI(apiKey)
    const model  = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME ?? 'gemini-2.5-flash' })
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nMensaje a analizar:\n${rawContent}`)
    const text   = result.response.text().trim()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed    = JSON.parse(jsonMatch?.[0] ?? text) as NormalizeResult
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
