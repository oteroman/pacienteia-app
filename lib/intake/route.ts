import type { IntakeChannel, IntakeIntent, IntakePriority } from './index'

// ── Auto-task intents ─────────────────────────────────────────
// These intents always generate an auto-task (no LLM suggestion needed)
const AUTO_TASK_INTENTS: IntakeIntent[] = ['appointment_request', 'urgent', 'lead_inquiry']

export function shouldCreateTask(intent: IntakeIntent): boolean {
  return AUTO_TASK_INTENTS.includes(intent)
}

// ── Default task templates per intent ────────────────────────
export function defaultTask(
  intent: IntakeIntent,
  contactName: string | null,
  summary: string,
): { title: string; description: string; priority: IntakePriority } {
  const name = contactName ?? 'contacto'

  switch (intent) {
    case 'urgent':
      return {
        title:       `URGENTE: atender a ${name}`,
        description: summary,
        priority:    'high',
      }
    case 'appointment_request':
      return {
        title:       `Agendar cita — ${name}`,
        description: summary,
        priority:    'high',
      }
    case 'lead_inquiry':
      return {
        title:       `Responder consulta de ${name}`,
        description: summary,
        priority:    'medium',
      }
    default:
      return {
        title:       `Revisar mensaje de ${name}`,
        description: summary,
        priority:    'low',
      }
  }
}

// ── Priority override rules ───────────────────────────────────
// Certain keywords in raw content escalate priority regardless of LLM output
const URGENT_KEYWORDS = [
  'urgente', 'emergencia', 'dolor', 'reacción', 'reaccion',
  'hinchazón', 'hinchazon', 'alergia', 'infección', 'infeccion',
  'ayuda', 'hoy mismo', 'ahora',
]

// ── Channel-level intent overrides ───────────────────────────
// Some channels carry implicit intent regardless of message content.
// TikTok lead forms are always qualified lead_inquiry leads.
const CHANNEL_INTENT_OVERRIDE: Partial<Record<IntakeChannel, IntakeIntent>> = {
  tiktok: 'lead_inquiry',
}

export function overridePriority(
  rawContent:    string,
  llmPriority:   IntakePriority,
  llmIntent:     IntakeIntent,
  channel?:      IntakeChannel,
): { priority: IntakePriority; intent: IntakeIntent } {
  // Channel-level intent override (e.g. TikTok lead forms are always leads)
  const channelIntent = channel ? CHANNEL_INTENT_OVERRIDE[channel] : undefined
  const effectiveIntent = channelIntent ?? llmIntent

  // Keyword escalation always wins over everything
  const lower = rawContent.toLowerCase()
  const hasUrgentKeyword = URGENT_KEYWORDS.some((kw) => lower.includes(kw))
  if (hasUrgentKeyword) {
    return { priority: 'high', intent: 'urgent' }
  }

  return { priority: llmPriority, intent: effectiveIntent }
}
