# Documentación de la Plataforma PacienteIA

Documentación técnica y funcional de todos los features implementados en PacienteIA.
Generada leyendo el código fuente real. Fecha: 2026-05-12.

---

## Índice de Documentos

| # | Documento | Descripción |
|---|-----------|-------------|
| 01 | [Score de Retención por Paciente](./01-score-retencion.md) | Algoritmo de puntuación 0-100 que predice riesgo de churn calculado en tiempo real desde el historial de citas |
| 02 | [Recordatorios Automáticos de Citas](./02-recordatorios.md) | Envío automático de recordatorios 24h y 2h antes de la cita, con mecánica de respuesta "1=confirmar / 2=reagendar" |
| 03 | [Seguimiento Post-Cita y Escudo de Reputación](./03-postcita-reputacion.md) | Encuesta de satisfacción automática 4-10h después de la cita, routing por score y protección de Google Reviews |
| 04 | [Reactivación de Pacientes Inactivos](./04-reactivacion.md) | Campaña automática de 2 pasos para pacientes sin visitas en 90+ días, con detección de respuesta positiva |
| 05 | [Pipeline de Leads](./05-pipeline-leads.md) | Captación y clasificación de leads con IA, SLA de respuesta, pipeline de estados y conversión a paciente+cita |
| 06 | [Bandeja Unificada WhatsApp](./06-bandeja-whatsapp.md) | Centro de comunicaciones: hilos de WhatsApp + leads pendientes en una sola vista, con compositor de mensajes |
| 07 | [Analytics y Reportería](./07-analytics.md) | Dashboard de KPIs operativos, funnel de negocio, métricas de eficiencia, reputación y revenue |
| 08 | [Copiloto IA](./08-copiloto-ia.md) | Extracción de tareas desde texto libre con Gemini, gestión de tareas automáticas y manuales |
| 09 | [Automatizaciones n8n](./09-automatizaciones-n8n.md) | Workflows de CRON que ejecutan recordatorios, encuestas y reactivación; referencia de IDs y horarios |
| 10 | [Profesionales y Horarios](./10-profesionales-horarios.md) | Configuración de equipo médico, disponibilidad semanal y bloqueos de fecha |
| 11 | [Backfill Inteligente de Slots](./11-backfill-inteligente.md) | Detección automática de slots libres por cancelación/no-show, scoring de candidatos y oferta por WhatsApp |
| 12 | [Oportunidades de Revenue](./12-oportunidades-revenue.md) | Detección de pacientes cuyo ciclo de retratamiento vence pronto pero sin cita agendada; widget de agenda en dashboard |
| 13 | [NLU Avanzado en Conversaciones](./13-nlu-conversaciones.md) | Clasificación Gemini de cada mensaje entrante (9 intents), auto-respuestas, tareas copilot y badges en inbox |
| 14 | [Auto-Agendamiento desde WhatsApp](./14-autoagendamiento-whatsapp.md) | Flujo conversacional de 2 pasos (servicio → slot → cita) activado por NLU sin intervención del staff |
| 15 | [Sugerencias de Respuesta IA](./15-sugerencias-respuesta-ia.md) | Botón "✨ Sugerencia IA" en el compositor de WhatsApp: Gemini genera un borrador con contexto del paciente e historial |
| 16 | [Vendedor IA — Paxi](./16-vendedor-ia.md) | Bot de WhatsApp para captar prospectos interesados en PacienteIA; flujo conversacional de 7 pasos, pipeline en `/platform/sales` |
| 17 | [Onboarding de Clínicas: WhatsApp Multi-App](./17-onboarding-clinicas-whatsapp.md) | Arquitectura multi-app de Meta, HMAC per-clínica con App Secret encriptado, flujo completo de configuración para nuevas clínicas |

---

## Arquitectura de Automatizaciones WhatsApp

El siguiente diagrama muestra cuándo y cómo dispara cada automatización en el ciclo de vida de un paciente.

```
PACIENTE AGENDA CITA
        │
        ├─ [D-1, 8:00 AM Lima] ─── n8n Yp1PyCvHvMBuzySR ──► POST /api/internal/appointment-reminders (type=24h)
        │                                                         │
        │                                                         ▼
        │                                              WhatsApp: "¿Podrás asistir? 1=Sí 2=Cambiar"
        │                                                         │
        │                                          ┌─────────────┴─────────────┐
        │                                     Responde "1"               Responde "2"
        │                                          │                           │
        │                                   status → confirmed        status → reschedule_requested
        │                                   WA: confirmación          WA: "un agente te contacta"
        │                                                             Conversación abierta en bandeja
        │
        ├─ [Mismo día, cada hora 7-15h Lima] ─── n8n zrg6OeyKQDxsScpq ──► POST /api/internal/appointment-reminders (type=2h)
        │                                                         │
        │                                                         ▼
        │                                              WhatsApp: "¡Hoy es tu cita! Te esperamos a las HH:MM"
        │
CITA SE COMPLETA (status=completed)
        │
        └─ [4-10h después, cada hora] ─── n8n GQBK1dLS4PL6k5Yi ──► POST /api/internal/appointment-followups
                                                                        │
                                                                        ▼
                                                             WhatsApp: Encuesta 1-5 estrellas
                                                                        │
                                             ┌──────────────────────────┴──────────────────────────┐
                                        Rating 4-5                                            Rating 1-3
                                             │                                                     │
                                    WA: Gracias + link Google Reviews               WA: "Nuestro equipo te contactará"
                                    (si Google URL configurada)                     Copilot task: Alerta de reputación (high)


PACIENTE INACTIVO (90+ días sin visita, sin cita futura)
        │
        ├─ [L-V 10:00 AM Lima] ─── n8n re29X6GI7IW9fooG ──► POST /api/internal/reactivation (step=1)
        │                                                         │
        │                                                         ▼
        │                                              WhatsApp: "Ha pasado tiempo... ¿agendamos? Responde SÍ"
        │                                                         │
        │                                    ┌────────────────────┴────────────────────┐
        │                               Responde SÍ                          Sin respuesta 7 días
        │                                    │                                          │
        │                          status → responded                    n8n h8gdAFoCKl1nT2Wy (lunes 10AM)
        │                          WA: "El equipo te contactará"         POST /reactivation (step=2)
        │                          Copilot task: Agendar cita (high)     WA: Follow-up "¿Te ayudamos hoy?"
        │
MENSAJE ENTRANTE DE WHATSAPP (cualquier momento)
        │
        ├─ Webhook Meta → /api/whatsapp/webhook/route.ts
        │       │
        │       ├─► handleBookingFlow()         → PRIMERO: intercepta "1/2/3" si hay auto-agendamiento activo
        │       ├─► handleRescheduleSelection() → intercepta "1/2/3" si hay reagendamiento activo
        │       ├─► handleReminderReply()     → si es "1" o "2" y hay recordatorio pendiente
        │       ├─► handleFollowupReply()     → si es "1"-"5" y hay follow-up pendiente
        │       ├─► handleReactivationReply() → si es respuesta positiva y hay campaña pendiente
        │       ├─► handleBackfillReply()     → si es "sí" y hay slot abierto notificado a este teléfono
        │       ├─► runNluPipeline()          → fire & forget: clasifica intent, acciones automáticas
        │       └─► Guarda en conversations + messages + webhook_queue (para n8n adicional)


MENSAJE "QUIERO UNA CITA" (NLU detecta appointment_request)
        │
        ▼ runNluPipeline() → startBookingFlow()
        │
        ▼
WA: Menú numerado de servicios
        │ (paciente responde "2")
        ▼ handleBookingFlow() → muestra próximos 3 slots disponibles
        │ (paciente responde "1")
        ├─ Paciente conocido → INSERT appointments (status: confirmed) + WA confirmación
        └─ Paciente nuevo   → copilot_task (priority: high) + WA "confirmamos en breve"
```

---

## Stack de tecnologías de automatización

| Capa              | Tecnología                     | Propósito                                         |
|-------------------|--------------------------------|---------------------------------------------------|
| Scheduler         | n8n                            | CRON + orquestación de llamadas a endpoints       |
| Endpoints         | Next.js API Routes             | Lógica de negocio protegida por CRON_SECRET       |
| Mensajería        | Meta Cloud API (WhatsApp)      | Envío y recepción de mensajes                    |
| IA (intakes)      | Anthropic Claude Haiku         | Clasificación de leads: intent + prioridad        |
| IA (copiloto)     | Google Gemini 2.5 Flash        | Extracción de tareas desde texto libre            |
| Base de datos     | Supabase (PostgreSQL + RLS)    | Persistencia multi-tenant de todos los datos      |
| Realtime          | Supabase Realtime              | Notificaciones en vivo en la bandeja de mensajes  |

---

## Variables de entorno requeridas

| Variable                  | Uso                                                    |
|---------------------------|--------------------------------------------------------|
| `CRON_SECRET`             | Autenticación de los endpoints internos de n8n        |
| `ADMIN_DASHBOARD_SECRET`  | Autenticación alternativa (query param ?key=)          |
| `GEMINI_API_KEY`          | API key de Google para el Copiloto                    |
| `GEMINI_MODEL_NAME`       | Modelo de Gemini (default: `gemini-2.5-flash`)        |
| `NEXT_PUBLIC_SUPABASE_URL`| URL del proyecto Supabase                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (admin, bypassa RLS)             |
| `WHATSAPP_ACCESS_TOKEN`   | Token de Meta Cloud API (o por branch en BD)          |
| `WHATSAPP_PHONE_NUMBER_ID`| ID del número de WhatsApp en Meta                    |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token de verificación del webhook de Meta     |
| `ANTHROPIC_API_KEY`       | API key de Anthropic para clasificación de intakes   |

---

## Notas para desarrolladores

- **Multi-tenant:** Toda query debe filtrar por `organization_id` y cuando aplique por `branch_id`. Ver `lib/tenant/context.ts`.
- **RLS:** Usar `createAdminClient()` solo en Server Actions y Route Handlers. Usar `createClient()` en Server Components.
- **Idempotencia:** Los endpoints de recordatorios y follow-ups verifican si ya se envió antes de enviar (campo `status != 'failed'` en la tabla de tracking).
- **Psicología:** La industria `psicologia` tiene reglas especiales: NUNCA mostrar el tipo de tratamiento en mensajes. El builder de recordatorios lo aplica automáticamente.
- **La Regla de Hierro:** La IA NUNCA da diagnósticos, prescripciones ni consejos de salud. Solo gestiona operaciones.
