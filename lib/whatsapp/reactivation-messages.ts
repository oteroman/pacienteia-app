import { firstNameOf } from './reminders'

export function buildReactivationStep1(opts: {
  patientFullName: string
  clinicName: string
}): string {
  const name = firstNameOf(opts.patientFullName)
  return `¡Hola ${name}! 🌟 Te saludamos desde ${opts.clinicName}.

Ha pasado un tiempo desde tu última visita y queremos que sepas que estamos aquí para seguir cuidándote.

¿Te gustaría agendar una cita próximamente? Responde *SÍ* y con gusto te ayudamos a encontrar el horario ideal. 😊`
}

export function buildReactivationStep2(opts: {
  patientFullName: string
  clinicName: string
}): string {
  const name = firstNameOf(opts.patientFullName)
  return `¡Hola ${name}! 👋 Te escribimos nuevamente desde ${opts.clinicName}.

Queremos asegurarnos de que puedas acceder fácilmente a tu próxima cita. Tienes prioridad en nuestros horarios disponibles.

¿Podemos ayudarte a agendar hoy? Solo responde *SÍ* y te contactamos enseguida.`
}

export function buildReactivationConfirmation(opts: {
  patientFullName: string
  clinicName: string
}): string {
  const name = firstNameOf(opts.patientFullName)
  return `¡Perfecto, ${name}! 🙌 Alguien de nuestro equipo en ${opts.clinicName} se comunicará contigo muy pronto para coordinar tu cita.

¡Gracias por confiar en nosotros!`
}

// Matches positive responses to reactivation messages
const POSITIVE_RE = /^\s*(s[ií]|yes|claro|dale|ok|bueno|quiero|me interesa|adelante|perfecto|vamos|listo)\b/i

export function isPositiveReply(body: string): boolean {
  return POSITIVE_RE.test(body.trim())
}
