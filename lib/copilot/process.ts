import Anthropic from '@anthropic-ai/sdk'

export interface ProcessResult {
  summary:     string
  commitments: string[]
  risks:       string[]
  tasks:       { title: string; description: string; priority: 'high' | 'medium' | 'low' }[]
}

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres un asistente de operaciones para clínicas estéticas en Lima, Perú.
Analiza el siguiente mensaje o nota de staff y extrae información estructurada.

Responde SOLO con JSON válido, sin texto adicional, con esta estructura exacta:
{
  "summary": "Resumen breve en 1-2 oraciones de lo ocurrido",
  "commitments": ["Compromiso 1 asumido por la clínica", "Compromiso 2..."],
  "risks": ["Riesgo u oportunidad 1", "Riesgo 2..."],
  "tasks": [
    {
      "title": "Título corto de la tarea accionable",
      "description": "Detalle de qué hacer y por qué",
      "priority": "high"
    }
  ]
}

Guías:
- commitments: promesas hechas al paciente (callbacks, descuentos, reagendamientos, etc.)
- risks: pacientes insatisfechos, amenazas de cancelación, oportunidades de venta perdidas
- tasks: acciones concretas que el staff debe completar (llamar, agendar, enviar info, etc.)
- priority: "high" si requiere acción hoy, "medium" si es esta semana, "low" si es eventual
- Si no hay commitments/risks/tasks, usa arrays vacíos []
- Responde siempre en español`

export async function processInteraction(rawContent: string): Promise<ProcessResult> {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: rawContent }],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  try {
    const parsed = JSON.parse(text) as ProcessResult
    return {
      summary:     parsed.summary     ?? '',
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      risks:       Array.isArray(parsed.risks)       ? parsed.risks       : [],
      tasks:       Array.isArray(parsed.tasks)       ? parsed.tasks       : [],
    }
  } catch {
    return {
      summary:     text.slice(0, 500),
      commitments: [],
      risks:       [],
      tasks:       [],
    }
  }
}
