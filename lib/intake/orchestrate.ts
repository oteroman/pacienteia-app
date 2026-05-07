import type { IntakePriority, IntakeIntent } from './index'

// ── SLA by priority ───────────────────────────────────────────
export const SLA_MINUTES: Record<IntakePriority, number> = {
  high:   60,    // 1 hour
  medium: 240,   // 4 hours
  low:    1440,  // 24 hours
}

export function computeSlaDue(priority: IntakePriority): Date {
  return new Date(Date.now() + SLA_MINUTES[priority] * 60_000)
}

// ── Follow-up deadline after waiting_customer ─────────────────
const FOLLOW_UP_HOURS: Record<IntakePriority, number> = {
  high:   24,
  medium: 48,
  low:    72,
}

export function computeFollowUpDue(priority: IntakePriority): Date {
  return new Date(Date.now() + FOLLOW_UP_HOURS[priority] * 3_600_000)
}

// ── SLA status for display ────────────────────────────────────
export interface SlaStatus {
  minutesLeft: number
  overdue:     boolean
  label:       string
  color:       string
}

export function getSlaStatus(slaDueAt: string | null): SlaStatus | null {
  if (!slaDueAt) return null
  const diff        = new Date(slaDueAt).getTime() - Date.now()
  const minutesLeft = Math.round(diff / 60_000)
  const overdue     = minutesLeft < 0
  const absMin      = Math.abs(minutesLeft)

  const label = overdue
    ? absMin < 60 ? `Vencido ${absMin}m`  : `Vencido ${Math.round(absMin / 60)}h`
    : minutesLeft < 60 ? `${minutesLeft}m` : `${Math.round(minutesLeft / 60)}h`

  const color = overdue
    ? 'bg-red-100 text-red-700'
    : minutesLeft <= 30
      ? 'bg-amber-100 text-amber-700'
      : 'bg-green-100 text-green-700'

  return { minutesLeft, overdue, label, color }
}

// ── Structured templates by intent ───────────────────────────
export type TemplateVariable = 'nombre' | 'fecha' | 'hora' | 'tratamiento'

export interface IntakeTemplate {
  label:     string
  text:      string
  variables: TemplateVariable[]
  cta:       string
  nextStep:  string
}

export const TEMPLATES: Record<IntakeIntent, IntakeTemplate[]> = {
  lead_inquiry: [
    {
      label:     'Rápida',
      text:      'Hola [nombre], gracias por contactarnos. Con gusto te brindamos información sobre nuestros tratamientos. ¿Qué servicio te interesa?',
      variables: ['nombre'],
      cta:       'Preguntar por tratamiento',
      nextStep:  'Esperar respuesta y proponer agendar consulta',
    },
    {
      label:     'Con fecha',
      text:      'Hola [nombre], qué bueno que nos escribiste. Ofrecemos [tratamiento] y otros tratamientos estéticos. ¿Te gustaría agendar una consulta para el [fecha]?',
      variables: ['nombre', 'tratamiento', 'fecha'],
      cta:       'Invitar a consulta',
      nextStep:  'Proponer fecha y confirmar en el sistema',
    },
  ],
  appointment_request: [
    {
      label:     'Con horario',
      text:      'Hola [nombre], claro que sí. Tenemos disponibilidad el [fecha] a las [hora]. ¿Te funciona ese horario?',
      variables: ['nombre', 'fecha', 'hora'],
      cta:       'Confirmar cita',
      nextStep:  'Agendar en el sistema y enviar confirmación',
    },
    {
      label:     'Preguntar',
      text:      'Hola [nombre], con gusto te agendamos. ¿Qué días y horarios te quedan mejor esta semana?',
      variables: ['nombre'],
      cta:       'Preguntar disponibilidad',
      nextStep:  'Agendar según respuesta del cliente',
    },
  ],
  followup: [
    {
      label:     'Post-tratamiento',
      text:      'Hola [nombre], esperamos que te estés sintiendo bien. ¿Cómo vas con los resultados del [tratamiento]? Cualquier duda, estamos aquí.',
      variables: ['nombre', 'tratamiento'],
      cta:       'Revisar evolución',
      nextStep:  'Documentar respuesta en el expediente del paciente',
    },
    {
      label:     'Recordatorio',
      text:      'Hola [nombre], te recordamos tu cita para el [fecha] a las [hora]. ¿Podrás asistir?',
      variables: ['nombre', 'fecha', 'hora'],
      cta:       'Confirmar asistencia',
      nextStep:  'Marcar cita como confirmada en el sistema',
    },
  ],
  urgent: [
    {
      label:     'Urgente',
      text:      'Hola [nombre], recibimos tu mensaje y lo estamos atendiendo con prioridad. Un miembro de nuestro equipo te contactará en los próximos minutos.',
      variables: ['nombre'],
      cta:       'Escalar ahora',
      nextStep:  'Notificar a coordinador o médico de guardia inmediatamente',
    },
  ],
  general: [
    {
      label:     'Genérica',
      text:      'Hola [nombre], gracias por contactarnos. Con gusto te asistimos. ¿Nos cuentas qué necesitas?',
      variables: ['nombre'],
      cta:       'Abrir conversación',
      nextStep:  'Reclasificar el intake según la respuesta recibida',
    },
  ],
}

// Backward-compat alias (used in old component, can remove later)
export const RESPONSE_TEMPLATES: Record<IntakeIntent, string[]> = Object.fromEntries(
  Object.entries(TEMPLATES).map(([intent, tpls]) => [intent, tpls.map((t) => t.text)])
) as Record<IntakeIntent, string[]>

// ── Suggested action label by intent ─────────────────────────
export const SUGGESTED_ACTION: Record<IntakeIntent, string> = {
  lead_inquiry:         'Responder con info del tratamiento + invitar a agendar',
  appointment_request:  'Confirmar disponibilidad y agendar cita',
  followup:             'Revisar historial del paciente y responder',
  urgent:               'Escalar a coordinador inmediatamente',
  general:              'Responder y reclasificar si hace falta',
}

// ── Escalation helpers ────────────────────────────────────────
export function isSlaBreaached(slaDueAt: string | null): boolean {
  if (!slaDueAt) return false
  return new Date(slaDueAt).getTime() < Date.now()
}

export function canEscalate(escalationLevel: number): boolean {
  return escalationLevel < 2
}
