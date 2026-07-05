'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient }   from '@/lib/supabase/admin'

export interface ParsedAppointmentCommand {
  patientName:      string | null
  patientId:        string | null
  professionalName: string | null
  professionalId:   string | null
  date:             string | null  // YYYY-MM-DD
  time:             string | null  // HH:MM
  serviceHint:      string | null
  isAppointmentRequest: boolean
}

export async function parseStaffTextCommand(
  text: string,
  organizationId: string,
  branchId: string,
): Promise<ParsedAppointmentCommand> {
  const empty: ParsedAppointmentCommand = {
    patientName: null, patientId: null,
    professionalName: null, professionalId: null,
    date: null, time: null, serviceHint: null,
    isAppointmentRequest: false,
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return empty

  const today = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Lima',
  })

  const prompt = `Hoy es ${today} (Lima, Perú).
Un recepcionista o médico envió este mensaje por WhatsApp:
"${text}"

Determina si es una solicitud para agendar una cita y extrae los datos.
Responde SOLO con JSON válido:

{
  "is_appointment_request": true | false,
  "patient_name": "nombre del paciente o null",
  "professional_name": "nombre del doctor/profesional o null",
  "date": "fecha en formato YYYY-MM-DD o null (resuelve relativos: 'viernes' = próximo viernes)",
  "time": "hora en formato HH:MM (24h) o null",
  "service_hint": "tipo de tratamiento mencionado o null"
}`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] ?? raw)

    const sb = createAdminClient() as any

    // Resolve patient ID from name
    let patientId: string | null = null
    if (parsed.patient_name) {
      const { data: patients } = await sb
        .from('patients')
        .select('id, full_name')
        .eq('organization_id', organizationId)
        .ilike('full_name', `%${parsed.patient_name}%`)
        .limit(3)
      if (patients?.length === 1) patientId = patients[0].id
    }

    // Resolve professional ID from name
    let professionalId: string | null = null
    if (parsed.professional_name) {
      const { data: pros } = await sb
        .from('professionals')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('branch_id', branchId)
        .ilike('name', `%${parsed.professional_name}%`)
        .limit(3)
      if (pros?.length === 1) professionalId = pros[0].id
    }

    return {
      patientName:          parsed.patient_name      ?? null,
      patientId,
      professionalName:     parsed.professional_name ?? null,
      professionalId,
      date:                 parsed.date              ?? null,
      time:                 parsed.time              ?? null,
      serviceHint:          parsed.service_hint      ?? null,
      isAppointmentRequest: !!parsed.is_appointment_request,
    }
  } catch {
    return empty
  }
}
