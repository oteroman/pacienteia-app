# Pipeline de Leads (Captación y Clasificación)

## ¿Qué hace?

Cuando llega un contacto nuevo (desde WhatsApp, formulario web, TikTok o ingreso manual), PacienteIA lo procesa automáticamente con IA, asigna una prioridad y calcula un SLA de respuesta. El lead entra a un pipeline visual donde el staff puede avanzarlo desde "Nuevo" hasta "Resuelto" o convertirlo directamente en paciente con una cita agendada.

## Cómo funciona

### Flujo de entrada de un lead

1. El lead llega por cualquier canal: WhatsApp, formulario web (`/api/intake/webform`), TikTok (`/api/intake/tiktok`), o ingreso manual (`/leads/new`).
2. Se llama a `processIntake()` que invoca la IA para normalizar el mensaje.
3. La IA (Claude Haiku) analiza el texto y devuelve:
   - `normalizedSummary`: resumen en una oración
   - `detectedIntent`: categoría del mensaje
   - `priority`: alta/media/baja
   - `suggestedTask`: tarea sugerida (opcional)
4. Se calcula el `sla_due_at` según la prioridad.
5. Se inserta el registro en `intakes` con todos los datos normalizados.
6. Si hay una tarea sugerida, se crea en `copilot_tasks`.
7. Se registra el evento `created` en `intake_events`.

### Clasificación de intención (IA)

| Intent                | Descripción                                              |
|-----------------------|----------------------------------------------------------|
| `lead_inquiry`        | Persona nueva consultando precios, tratamientos, disponibilidad |
| `appointment_request` | Quiere agendar o reagendar una cita específica           |
| `followup`            | Paciente existente con preguntas post-tratamiento       |
| `urgent`              | Dolor, reacción adversa, queja grave, emergencia         |
| `general`             | Consulta genérica sin acción clara                       |

### Clasificación de prioridad

| Prioridad | Criterio                                                | SLA de respuesta |
|-----------|---------------------------------------------------------|------------------|
| `high`    | Urgencias, citas para hoy/mañana, quejas, leads calificados | 60 minutos    |
| `medium`  | Leads normales, citas próxima semana, seguimientos      | 4 horas (240 min)|
| `low`     | Consultas informativas, sin fecha, sin urgencia         | 24 horas (1440 min)|

El SLA se calcula desde el momento de creación del intake.

### Estados del pipeline

```
nuevo  →  en_contacto  →  esperando_cliente  →  resuelto
                                                      ↕
                                               (archivado)
```

| Status             | Descripción                                      | Acción del staff |
|--------------------|--------------------------------------------------|------------------|
| `new`              | Recién llegado, sin atender                      | "Marcar en contacto" |
| `in_progress`      | Staff está en contacto activo con el lead        | "Esperando respuesta" o "Agendar cita" |
| `waiting_customer` | Se envió respuesta, esperando que el lead conteste | "Retomar contacto" |
| `resolved`         | Lead atendido y cerrado                          | —               |
| `dismissed`        | Archivado (spam, sin interés, duplicado)         | —               |

El campo `first_response_at` se registra la primera vez que el lead entra a estado `in_progress`.

### Conversión a paciente y cita

Desde la ficha del lead:
1. **"Crear paciente desde este lead"**: crea un registro en `patients` con los datos del contacto y vincula el intake via `patient_id`.
2. **"Agendar cita"**: si no existe paciente aún, lo crea primero; luego redirige al formulario de nueva cita con el `patient_id` y `lead_id` pre-cargados.

## Visualización en la bandeja

La página `/inbox` muestra los leads junto a las conversaciones de WhatsApp. Cada lead muestra:
- Nombre del contacto
- Canal de origen (badge de color)
- Resumen normalizado por IA
- Indicador de SLA vencido (badge rojo "SLA")

## Plantillas de respuesta sugeridas

Por cada intención, el sistema tiene plantillas de respuesta para el staff:
- `lead_inquiry`: 2 plantillas (rápida y con fecha)
- `appointment_request`: 2 plantillas (con horario y preguntar disponibilidad)
- `followup`: 2 plantillas (post-tratamiento y recordatorio)
- `urgent`: 1 plantilla de escalación
- `general`: 1 plantilla genérica

Las plantillas tienen variables como `[nombre]`, `[fecha]`, `[hora]`, `[tratamiento]`.

## Tablas de BD involucradas

| Tabla           | Uso                                              |
|-----------------|--------------------------------------------------|
| `intakes`       | Registro principal del lead con todos los campos |
| `intake_events` | Timeline de eventos: creado, cambio de estado, notas |
| `patients`      | Paciente vinculado cuando se convierte el lead   |
| `copilot_tasks` | Tareas sugeridas por la IA al procesar el intake |

## Archivos clave

| Archivo                                      | Propósito                                             |
|----------------------------------------------|-------------------------------------------------------|
| `lib/intake/normalize.ts`                    | Clasificación con IA (Claude Haiku) — intent + priority |
| `lib/intake/orchestrate.ts`                  | SLA: cálculo de `sla_due_at`, `getSlaStatus`, plantillas |
| `lib/intake/index.ts`                        | Tipos, labels, `fetchInbox`                          |
| `app/actions/intake.ts`                      | `processIntake` — orquesta normalización y creación  |
| `app/actions/leads.ts`                       | `createManualLead`, `convertLeadToPatient`, `scheduleLeadAppointment`, etc. |
| `app/(dashboard)/leads/page.tsx`             | Lista de leads con filtros por estado                |
| `app/(dashboard)/leads/[id]/page.tsx`        | Detalle: pipeline stepper, timeline, acciones        |
| `app/(dashboard)/leads/new/page.tsx`         | Formulario de ingreso manual                         |
| `app/api/intake/webform/route.ts`            | Webhook para formularios web                         |
| `app/api/intake/tiktok/route.ts`             | Webhook para leads de TikTok                         |
