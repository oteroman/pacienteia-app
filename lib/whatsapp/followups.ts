import { firstNameOf } from './reminders'

export { firstNameOf }

export function buildFollowupSurveyMessage(opts: {
  patientFirstName: string
  clinicName: string
  treatmentType: string | null
}): string {
  const { patientFirstName, clinicName, treatmentType } = opts
  const tratamiento = treatmentType ? ` de ${treatmentType}` : ''

  return (
    `¡Hola ${patientFirstName}! 😊\n\n` +
    `Gracias por visitarnos hoy en *${clinicName}*.\n\n` +
    `Queremos saber cómo estuvo tu atención${tratamiento}. ` +
    `¿Cómo la calificarías?\n\n` +
    `Responde solo con el número:\n` +
    `*5* — Excelente\n` +
    `*4* — Muy buena\n` +
    `*3* — Buena\n` +
    `*2* — Regular\n` +
    `*1* — Mala\n\n` +
    `Tu opinión nos ayuda a mejorar 🙏`
  )
}

export function buildReviewThankyouMessage(opts: {
  patientFirstName: string
  clinicName: string
  rating: number
  googleReviewUrl: string
}): string {
  const { patientFirstName, clinicName, rating, googleReviewUrl } = opts
  const emoji = rating === 5 ? '🌟' : '😊'

  return (
    `${emoji} ¡Muchas gracias, ${patientFirstName}! Nos alegra saber que tuviste una ` +
    `${rating === 5 ? 'excelente' : 'muy buena'} experiencia.\n\n` +
    `Si tienes un minuto, dejarnos una reseña en Google nos ayuda muchísimo a seguir mejorando:\n` +
    `${googleReviewUrl}\n\n` +
    `¡Hasta la próxima! ❤️ — *${clinicName}*`
  )
}

export function buildAlertThankyouMessage(opts: {
  patientFirstName: string
  clinicName: string
}): string {
  const { patientFirstName, clinicName } = opts
  return (
    `Gracias por compartir tu experiencia, ${patientFirstName}.\n\n` +
    `Tu opinión es muy importante para nosotros. Nuestro equipo revisará tu comentario ` +
    `y se pondrá en contacto contigo a la brevedad.\n\n` +
    `— *${clinicName}*`
  )
}
