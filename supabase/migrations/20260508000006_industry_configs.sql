-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Industry configuration
-- Defines the "DNA" of each supported industry.
-- Loaded at runtime to drive: fields, templates, n8n workflows, Gemini prompts.
-- RLS: public read for authenticated users (no clinical data here).
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE public.industry_configs (
  industry              TEXT    PRIMARY KEY
                                CHECK (industry IN ('estetica','dental','psicologia','medicina')),
  display_name          TEXT    NOT NULL,
  -- JSON array of field definitions for patients and appointments
  -- [{key, label, type, options?, required?, entity: 'patient'|'appointment'}]
  custom_fields         JSONB   NOT NULL DEFAULT '[]',
  -- Named templates for WhatsApp messages keyed by trigger event
  message_templates     JSONB   NOT NULL DEFAULT '{}',
  -- n8n workflow IDs keyed by trigger event (resolved at runtime)
  workflow_triggers     JSONB   NOT NULL DEFAULT '{}',
  -- Base system prompt for Gemini. Placeholders: {clinic_name} {city} {branch_name}
  gemini_system_prompt  TEXT    NOT NULL DEFAULT ''
);

ALTER TABLE public.industry_configs ENABLE ROW LEVEL SECURITY;

-- Public read for any authenticated user (org members load this on init)
CREATE POLICY "industry_configs: authenticated read"
  ON public.industry_configs FOR SELECT
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────────────────
-- SEED: Clínica Estética (MVP — first to launch)
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.industry_configs (industry, display_name, custom_fields, message_templates, workflow_triggers, gemini_system_prompt)
VALUES (
  'estetica',
  'Clínica Estética',

  '[
    {"key":"skin_type",       "label":"Tipo de piel",          "type":"select",
     "options":["normal","seca","grasa","mixta","sensible"],    "entity":"patient"},
    {"key":"allergies",       "label":"Alergias conocidas",    "type":"text",    "entity":"patient"},
    {"key":"prev_treatments", "label":"Tratamientos previos",  "type":"textarea","entity":"patient"},
    {"key":"treatment_area",  "label":"Área de tratamiento",   "type":"text",    "entity":"appointment"},
    {"key":"session_number",  "label":"N° de sesión",          "type":"number",  "entity":"appointment"}
  ]',

  '{
    "appointment_reminder":"Hola {patient_name} 👋 Te recordamos tu cita en {clinic_name} mañana {date} a las {time}. ¿Confirmas tu asistencia? Responde SÍ o NO.",
    "appointment_confirmed":"¡Perfecto {patient_name}! Tu cita está confirmada para mañana a las {time}. Te esperamos 💆‍♀️",
    "appointment_cancelled": "Entendemos {patient_name}. Tu cita ha sido cancelada. ¿Te gustaría reagendar para otra fecha?",
    "post_appointment":      "Hola {patient_name} 🌟 ¿Cómo te has sentido tras tu tratamiento? Estamos aquí si tienes alguna consulta.",
    "reactivation_step1":    "Hola {patient_name}, hace tiempo que no te vemos en {clinic_name}. ¿Todo bien? Nos encantaría ayudarte a recuperar tu rutina de cuidado 🌸",
    "reactivation_step2":    "Hola {patient_name} 💕 Esta semana tenemos un horario disponible especialmente para ti. ¿Te apetece retomar tu tratamiento?",
    "lead_welcome":          "Hola {contact_name} 👋 Gracias por contactar a {clinic_name}. Somos especialistas en medicina estética. ¿En qué tratamiento estás interesada/o?",
    "lead_followup":         "Hola {contact_name}, solo quería confirmar si tuvistetiempo de revisar la información que te enviamos. ¿Tienes alguna pregunta?"
  }',

  '{
    "new_lead":              "wf_estetica_lead_intake",
    "appointment_reminder":  "wf_estetica_reminder",
    "appointment_no_show":   "wf_estetica_noshow",
    "reactivation":          "wf_estetica_reactivation",
    "slot_opened":           "wf_estetica_backfill",
    "post_appointment":      "wf_estetica_post_visit"
  }',

  'Eres la asistente virtual de {clinic_name}, una clínica de medicina estética ubicada en {city}.

SUCURSAL ACTIVA: {branch_name}

TU ROL:
- Clasificar leads por nivel de interés: alto (pregunta por precio/cita), medio (interesada pero exploratoria), bajo (solo curiosidad).
- Agendar consultas iniciales gratuitas y citas de tratamiento.
- Responder preguntas sobre tratamientos: botox, rellenos, peelings, mesoterapia, PRP, láser, hidratación, y lifting sin cirugía.
- Reactivar pacientes inactivos con tono empático, no invasivo.
- Hacer seguimiento post-cita (cómo se siente, si tiene dudas).

REGLAS ABSOLUTAS:
- NUNCA diagnostiques condiciones médicas.
- NUNCA des precios exactos sin autorización explícita del equipo. Invita a una consulta gratuita.
- Si el paciente reporta una reacción adversa, deriva INMEDIATAMENTE a atención presencial.
- No menciones a la competencia.
- Si no tienes la información para responder, di: "Déjame confirmarlo con el equipo y te escribo en breve."
- Las decisiones de negocio (descuentos, excepciones de política) no son tuyas; escala al staff.

TONO: Cálido, profesional, empático. Tutea al paciente. Usa emojis con moderación (máximo 1-2 por mensaje).'
);

-- ──────────────────────────────────────────────────────────────────────────
-- SEED: Clínica Dental
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.industry_configs (industry, display_name, custom_fields, message_templates, workflow_triggers, gemini_system_prompt)
VALUES (
  'dental',
  'Clínica Dental',

  '[
    {"key":"in_orthodontics",    "label":"En ortodoncia",          "type":"boolean", "entity":"patient"},
    {"key":"last_xray_date",     "label":"Última radiografía",     "type":"date",    "entity":"patient"},
    {"key":"dental_insurance",   "label":"Seguro dental",          "type":"text",    "entity":"patient"},
    {"key":"allergies",          "label":"Alergias (anestesia)",   "type":"text",    "entity":"patient"},
    {"key":"tooth_reference",    "label":"Pieza dental",           "type":"text",    "entity":"appointment"},
    {"key":"procedure_type",     "label":"Tipo de procedimiento",  "type":"select",
     "options":["limpieza","extracción","endodoncia","ortodoncia","implante","blanqueamiento","revisión"],
     "entity":"appointment"}
  ]',

  '{
    "appointment_reminder":"Hola {patient_name} 😊 Te recordamos tu cita dental en {clinic_name} mañana {date} a las {time}. Por favor llega 10 min antes. ¿Confirmas?",
    "appointment_confirmed":"¡Perfecto {patient_name}! Cita confirmada para mañana a las {time}. Recuerda llegar 10 minutos antes 🦷",
    "urgency_triage":       "Hola {contact_name}, entendemos que tienes una urgencia dental. ¿Puedes describirnos brevemente el dolor o problema? Lo atenderemos lo antes posible.",
    "post_appointment":     "Hola {patient_name}, esperamos que tu tratamiento haya ido bien. Recuerda seguir las indicaciones dadas. ¿Tienes alguna duda?",
    "reactivation_step1":   "Hola {patient_name}, han pasado más de 6 meses desde tu última visita a {clinic_name}. Te recomendamos una revisión preventiva. ¿Te gustaría agendar?",
    "lead_welcome":         "Hola {contact_name} 👋 Gracias por contactar a {clinic_name}. ¿Es tu primera visita? ¿Tienes algún problema específico o buscas una revisión general?"
  }',

  '{
    "new_lead":             "wf_dental_lead_intake",
    "urgency":              "wf_dental_urgency",
    "appointment_reminder": "wf_dental_reminder",
    "appointment_no_show":  "wf_dental_noshow",
    "reactivation":         "wf_dental_reactivation",
    "slot_opened":          "wf_dental_backfill"
  }',

  'Eres la asistente virtual de {clinic_name}, una clínica dental ubicada en {city}.

SUCURSAL ACTIVA: {branch_name}

TU ROL:
- Clasificar urgencias (dolor agudo, sangrado, trauma) vs. consultas de rutina.
- Agendar citas de revisión, limpieza y tratamientos específicos.
- Responder preguntas generales sobre ortodoncia, implantes, blanqueamiento, endodoncia, extracciones.
- Reactivar pacientes que no han asistido en más de 6 meses.

REGLAS ABSOLUTAS:
- PRIORIZA SIEMPRE las urgencias: dolor intenso, sangrado activo o trauma facial → cita urgente o urgencias hospitalarias si es fuera de horario.
- NUNCA diagnostiques ni prescribas medicamentos, incluyendo analgésicos.
- Si el paciente menciona dolor intenso fuera de horario de atención, indica: "Te recomendamos acudir a urgencias o llamar al {emergency_number} si el dolor es muy intenso."
- No improvises precios de tratamientos específicos.
- Tono: claro, confiable, tranquilizador. No uses emojis en mensajes de urgencia.'
);

-- ──────────────────────────────────────────────────────────────────────────
-- SEED: Consultorio Psicológico
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.industry_configs (industry, display_name, custom_fields, message_templates, workflow_triggers, gemini_system_prompt)
VALUES (
  'psicologia',
  'Consultorio Psicológico',

  '[
    {"key":"consultation_reason", "label":"Motivo de consulta",       "type":"textarea","entity":"patient"},
    {"key":"referred_by",         "label":"Derivado por",             "type":"text",    "entity":"patient"},
    {"key":"insurance_provider",  "label":"Seguro/EPS",               "type":"text",    "entity":"patient"},
    {"key":"session_modality",    "label":"Modalidad de sesión",      "type":"select",
     "options":["presencial","virtual","mixta"],                       "entity":"appointment"},
    {"key":"session_number",      "label":"N° de sesión",             "type":"number",  "entity":"appointment"},
    {"key":"authorized_sessions", "label":"Sesiones autorizadas",     "type":"number",  "entity":"patient"}
  ]',

  '{
    "appointment_reminder":"Hola {patient_name}, te recordamos tu sesión en {clinic_name} mañana {date} a las {time}. ¿Confirmas tu asistencia?",
    "appointment_confirmed":"Confirmado {patient_name}. Te esperamos mañana a las {time}. Si necesitas reagendar con anticipación, escríbenos.",
    "appointment_cancelled":"Entendemos {patient_name}. Tu sesión ha sido cancelada. Recuerda que la continuidad es importante para tu proceso. ¿Te gustaría reagendar?",
    "lead_welcome":         "Hola {contact_name}, gracias por contactarnos. En {clinic_name} estamos aquí para acompañarte. ¿Quisiste saber sobre algún tipo de consulta o apoyo psicológico en particular?",
    "reactivation_step1":   "Hola {patient_name}, hace tiempo que no tenemos contacto. Espero que estés bien. Estamos disponibles si deseas retomar tu proceso."
  }',

  '{
    "new_lead":             "wf_psicologia_lead_intake",
    "appointment_reminder": "wf_psicologia_reminder",
    "appointment_no_show":  "wf_psicologia_noshow",
    "reactivation":         "wf_psicologia_reactivation"
  }',

  'Eres la asistente virtual de {clinic_name}, un consultorio psicológico ubicado en {city}.

SUCURSAL ACTIVA: {branch_name}

TU ROL:
- Recibir consultas y derivar al profesional adecuado.
- Agendar sesiones iniciales de evaluación y sesiones de seguimiento.
- Responder preguntas generales sobre los servicios ofrecidos.
- Confirmar y recordar citas.

REGLAS ABSOLUTAS DE SEGURIDAD:
- Si el usuario menciona pensamientos de hacerse daño, ideas suicidas, o una crisis, responde INMEDIATAMENTE:
  "Entiendo que estás pasando por un momento muy difícil. Por favor comunícate ahora con la Línea de Crisis: 113 (Perú) o con emergencias. Un profesional está disponible para ayudarte."
  Luego notifica al staff de forma interna.
- NUNCA diagnostiques trastornos mentales.
- NUNCA des consejos terapéuticos específicos (eso es rol del profesional en sesión).
- NUNCA minimices el estado emocional del usuario con frases como "no es para tanto".
- Mantén un tono cálido, neutro y sin juicios. No uses emojis en mensajes sensibles.
- La confidencialidad es prioritaria: no solicites información clínica por WhatsApp.'
);

-- ──────────────────────────────────────────────────────────────────────────
-- SEED: Consultorio Médico (Medicina General)
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.industry_configs (industry, display_name, custom_fields, message_templates, workflow_triggers, gemini_system_prompt)
VALUES (
  'medicina',
  'Consultorio Médico',

  '[
    {"key":"blood_type",       "label":"Grupo sanguíneo",       "type":"select",
     "options":["A+","A-","B+","B-","AB+","AB-","O+","O-"],    "entity":"patient"},
    {"key":"chronic_conditions","label":"Enfermedades crónicas","type":"textarea","entity":"patient"},
    {"key":"current_medication","label":"Medicación actual",    "type":"textarea","entity":"patient"},
    {"key":"allergies",        "label":"Alergias medicamentos", "type":"text",    "entity":"patient"},
    {"key":"insurance_number", "label":"N° de asegurado",       "type":"text",    "entity":"patient"},
    {"key":"consultation_type","label":"Tipo de consulta",      "type":"select",
     "options":["primera_vez","seguimiento","control","urgencia","certificado"],
     "entity":"appointment"}
  ]',

  '{
    "appointment_reminder":"Hola {patient_name}, te recordamos tu consulta médica en {clinic_name} mañana {date} a las {time}. Por favor trae tu documento de identidad y carnet de seguro. ¿Confirmas?",
    "appointment_confirmed":"Confirmado {patient_name}. Te esperamos mañana a las {time}. Recuerda traer tus documentos y llegar 10 minutos antes.",
    "urgency_triage":       "Hola {contact_name}, ¿puedes describir brevemente tus síntomas? Te ayudaremos a determinar si necesitas atención urgente hoy.",
    "post_appointment":     "Hola {patient_name}, esperamos que te encuentres bien. Si tienes dudas sobre las indicaciones médicas, estamos aquí para orientarte.",
    "reactivation_step1":   "Hola {patient_name}, hace tiempo que no registramos una consulta tuya en {clinic_name}. Si necesitas un control o tienes algún malestar, con gusto te atendemos.",
    "lead_welcome":         "Hola {contact_name}, gracias por contactar a {clinic_name}. ¿Buscas una primera consulta, un control o atención por algún síntoma específico?"
  }',

  '{
    "new_lead":             "wf_medicina_lead_intake",
    "urgency":              "wf_medicina_urgency",
    "appointment_reminder": "wf_medicina_reminder",
    "appointment_no_show":  "wf_medicina_noshow",
    "reactivation":         "wf_medicina_reactivation"
  }',

  'Eres la asistente virtual de {clinic_name}, un consultorio médico de medicina general ubicado en {city}.

SUCURSAL ACTIVA: {branch_name}

TU ROL:
- Recibir consultas, clasificar urgencia e identificar el tipo de atención requerida.
- Agendar consultas de primera vez, seguimiento y controles.
- Solicitar información básica previa a la consulta (síntomas, medicación actual).
- Confirmar y recordar citas.

REGLAS ABSOLUTAS DE SEGURIDAD:
- Si el paciente describe síntomas de emergencia (dolor de pecho, dificultad respiratoria grave, pérdida de conciencia, sangrado abundante), responde INMEDIATAMENTE:
  "Estos síntomas requieren atención médica urgente. Llama al 117 (SAMU Perú) o dirígete a la emergencia del hospital más cercano ahora."
- NUNCA diagnostiques enfermedades ni prescribas medicamentos.
- NUNCA interpretes resultados de exámenes de laboratorio o imágenes.
- Si el paciente pregunta si puede suspender un medicamento recetado, responde: "Esa decisión la debe tomar tu médico. No suspendas medicación sin consultarlo."
- No uses términos médicos complejos sin explicarlos de forma simple.
- Tono: claro, profesional, tranquilizador. Sin emojis en mensajes de síntomas graves.'
);

COMMIT;
