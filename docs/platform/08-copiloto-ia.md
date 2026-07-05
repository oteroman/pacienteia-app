# Copiloto IA

## ¿Qué hace?

El Copiloto es un asistente de operaciones con inteligencia artificial. El staff puede registrar cualquier interacción (notas de una llamada, conversación de WhatsApp, reunión con paciente, etc.) en texto libre, y el Copiloto extrae automáticamente las tareas concretas que deben completarse, los compromisos adquiridos con el paciente y los riesgos identificados. Las tareas también se generan automáticamente desde otros módulos (reactivación, alertas de reputación).

## Cómo funciona

### Creación manual de tarea via interacción

1. El staff va a `/copilot/new` y escribe texto libre describiendo lo ocurrido.
2. Puede vincular la interacción a un paciente (dropdown con búsqueda) y elegir el tipo de fuente.
3. Al enviar, se llama a `processInteraction()` que hace una llamada a Google Gemini.
4. Gemini devuelve JSON estructurado con summary, commitments, risks y tasks.
5. Las tareas se insertan en `copilot_tasks` con status `open`.
6. Se redirige a `/copilot?analizado=1&tareas=N` mostrando cuántas tareas se generaron.

### Prompt del Copiloto (Gemini)

El sistema usa el modelo `gemini-2.5-flash` con las siguientes instrucciones:

- `summary`: resumen en 1-2 oraciones
- `commitments`: promesas hechas al paciente (callbacks, descuentos, reagendamientos)
- `risks`: pacientes insatisfechos, amenazas de cancelación, oportunidades perdidas
- `tasks`: acciones concretas con título, descripción y prioridad

**Criterios de prioridad:**
| Prioridad | Criterio                                              |
|-----------|-------------------------------------------------------|
| `high`    | Requiere acción hoy                                   |
| `medium`  | Esta semana                                           |
| `low`     | Eventual, sin urgencia                                |

### Creación automática de tareas

El Copiloto recibe tareas de otros módulos automáticamente:

| Origen                    | Título automático                                       | Prioridad |
|---------------------------|----------------------------------------------------------|-----------|
| Reactivación (paciente responde) | `Agendar cita — [Nombre] respondió a campaña de reactivación` | high |
| Alerta de reputación (rating 1-3) | `⚠️ Alerta de reputación: [Nombre] calificó [X]/5`  | high |
| Clasificación de intake   | Tarea sugerida por la IA al normalizar un lead           | variable  |

Estos registros tienen el campo `source` indicando su origen (`reactivation`, `reputation_alert`).

### Dashboard del Copiloto (`/copilot`)

La página muestra dos secciones:

**Tareas abiertas:**
- Ordenadas por prioridad (alta → media → baja)
- Cada tarjeta muestra: badge de prioridad, nombre del paciente (si aplica), tipo de fuente, título, descripción (primeras 2 líneas)
- Acciones: Ver (página de detalle), Listo, Ignorar
- Límite: 50 tareas abiertas más recientes

**Completadas e ignoradas:**
- Colapsado por defecto (toggle "Ver historial")
- Muestra las últimas 20 tareas con status `done` o `dismissed`
- Ordenadas por `resolved_at` descendente

### Tipos de fuente

| Fuente           | Label                |
|------------------|----------------------|
| `whatsapp_text`  | WhatsApp texto       |
| `whatsapp_audio` | Audio / voz          |
| `phone_call`     | Llamada              |
| `staff_note`     | Nota de staff        |
| `chat`           | Chat                 |

### Estados de tareas

| Status      | Descripción                         |
|-------------|-------------------------------------|
| `open`      | Tarea pendiente de atención         |
| `done`      | Completada por el staff             |
| `dismissed` | Ignorada (no aplica o es duplicado) |

## Configuración

- El modelo de IA se configura con la variable de entorno `GEMINI_MODEL_NAME` (default: `gemini-2.5-flash`).
- Si `GEMINI_API_KEY` no está configurada, la creación de interacciones fallará.

## Tablas de BD involucradas

| Tabla           | Uso                                                     |
|-----------------|---------------------------------------------------------|
| `copilot_tasks` | Tareas: título, descripción, prioridad, status, origen |
| `patients`      | Vinculación de tareas a pacientes                      |

Nota: La tabla `interactions` e `interaction_summaries` están referenciadas en el código legacy pero las tareas nuevas se insertan directamente en `copilot_tasks` sin pasar por ellas.

## Archivos clave

| Archivo                                        | Propósito                                           |
|------------------------------------------------|-----------------------------------------------------|
| `lib/copilot/process.ts`                       | `processInteraction()` — llamada a Gemini y parseo |
| `lib/copilot/index.ts`                         | `fetchCopilotDashboard()`, tipos, labels            |
| `app/(dashboard)/copilot/page.tsx`             | Lista de tareas abiertas y completadas              |
| `app/(dashboard)/copilot/new/page.tsx`         | Formulario de nueva interacción                     |
| `app/(dashboard)/copilot/new/NewInteractionForm.tsx` | Componente cliente del formulario             |
| `app/(dashboard)/copilot/tasks/[id]/page.tsx`  | Detalle de una tarea                                |
| `app/actions/copilot.ts`                       | `resolveTask`, `dismissTask`, `createInteraction`   |
