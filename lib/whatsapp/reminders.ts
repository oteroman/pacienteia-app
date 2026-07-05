// Message builders for appointment reminders and confirmation flows.
// CX principles applied:
//  - 1/2 reply mechanic (lower friction than typing OK/CANCELAR)
//  - Reagendar as default cancel path (preserves revenue)
//  - First name only for warmth
//  - Psicología: never mention treatment type (privacy rule)

export type Industry = 'estetica' | 'dental' | 'psicologia' | 'medicina'

// Normalizes a Peruvian phone number to E.164 digits (e.g. "51987654321").
// Used to store contact_phone in appointment_reminders so inbound replies match.
export function normalizePhonePE(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`
  if (digits.length === 11 && digits.startsWith('51')) return digits
  if (digits.length === 12 && digits.startsWith('051')) return digits.slice(1)
  return digits
}

export function firstNameOf(fullName: string): string {
  return fullName.split(' ')[0]
}

const LIMA_TZ = 'America/Lima'

export function formatTimeLima(isoUtc: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA_TZ,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(isoUtc))
}

export function formatWeekdayDayLima(isoUtc: string): string {
  // Returns e.g. "martes 14"
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA_TZ,
    weekday:  'long',
    day:      'numeric',
  }).format(new Date(isoUtc))
}

export function buildReminderMessage(opts: {
  patientFirstName: string
  scheduledAt: string
  doctorFullName: string | null
  clinicName: string
  treatmentType: string
  industry: Industry
  reminderType: '24h' | '2h'
}): string {
  const {
    patientFirstName, scheduledAt, doctorFullName,
    clinicName, treatmentType, industry, reminderType,
  } = opts

  const timeFormatted = formatTimeLima(scheduledAt)
  // Use only doctor's first name for a warmer tone
  const doctorLabel = doctorFullName
    ? `Dr. ${firstNameOf(doctorFullName)}`
    : clinicName
  const isPsico = industry === 'psicologia'

  if (reminderType === '24h') {
    const dayLabel = formatWeekdayDayLima(scheduledAt)
    const treatmentPart = isPsico ? '' : ` de *${treatmentType}*`
    return (
      `Hola ${patientFirstName} 😊\n\n` +
      `Te recordamos que mañana *${dayLabel}* a las *${timeFormatted}* ` +
      `tienes tu cita${treatmentPart} con *${doctorLabel}* en *${clinicName}*.\n\n` +
      `¿Podrás asistir?\n` +
      `→ Escribe *1* para confirmar ✅\n` +
      `→ Escribe *2* si necesitas cambiar el horario 📅`
    )
  }

  // 2h reminder — short nudge, no reply mechanic needed
  const treatmentPart = isPsico ? 'cita' : `cita de *${treatmentType}*`
  return (
    `Hola ${patientFirstName}, ¡hoy es tu ${treatmentPart}! 🙌\n\n` +
    `En unas horas te esperamos a las *${timeFormatted}* con *${doctorLabel}*. ` +
    `Recuerda llegar 5 min antes 😊`
  )
}

export function buildConfirmationMessage(opts: {
  patientFirstName: string
  scheduledAt: string
  clinicName: string
}): string {
  const { patientFirstName, scheduledAt, clinicName } = opts
  const timeFormatted = formatTimeLima(scheduledAt)
  return (
    `✅ ¡Perfecto, ${patientFirstName}! Tu cita está confirmada.\n\n` +
    `Te esperamos a las *${timeFormatted}* en *${clinicName}*.`
  )
}

export function buildRescheduleMessage(opts: {
  patientFirstName: string
  clinicName: string
}): string {
  const { patientFirstName, clinicName } = opts
  return (
    `Entendido, ${patientFirstName}. Con gusto buscamos otro horario para ti.\n\n` +
    `Un agente de *${clinicName}* te escribirá pronto para coordinar 📅`
  )
}
