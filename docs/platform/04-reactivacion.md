# Reactivación de Pacientes Inactivos

## ¿Qué hace?

PacienteIA identifica automáticamente pacientes que llevan mucho tiempo sin visitar la clínica y les envía mensajes de WhatsApp para invitarlos a volver. La campaña tiene dos pasos: un mensaje inicial de bienvenida y, si no responden, un recordatorio 7 días después. Cuando el paciente responde positivamente, se crea una tarea en el Copiloto para que el staff los contacte y agende la cita.

## Cómo funciona

### Paso 1: Campaña inicial (warm message)

**Criterios de elegibilidad:**
- Paciente con `status` diferente de `blocked` o `lead`
- `last_visit_date` hace 90 o más días
- No fue contactado en una campaña de reactivación en los últimos 30 días
- No tiene una cita futura agendada (`scheduled` o `confirmed`)
- Tiene teléfono registrado

**Ejecución:**
1. El workflow n8n `re29X6GI7IW9fooG` se ejecuta lunes a viernes a las 10:00 AM Lima (pendiente activar).
2. n8n hace un POST a `/api/internal/reactivation` con `step=1`.
3. El endpoint aplica los filtros y selecciona hasta 20 pacientes (máximo 50 por ejecución).
4. Envía el mensaje paso 1 a cada paciente y registra en `reactivation_campaigns`.

### Paso 2: Follow-up (7 días sin respuesta)

1. El workflow n8n `h8gdAFoCKl1nT2Wy` se ejecuta los lunes a las 10:00 AM Lima (pendiente activar).
2. n8n hace un POST a `/api/internal/reactivation` con `step=2`.
3. El endpoint busca campañas paso 1 con status `sent` enviadas hace 7 o más días.
4. Excluye pacientes que ya tienen un mensaje paso 2.
5. Envía el mensaje paso 2.

### Paso 3: Cuando el paciente responde

Cuando llega cualquier mensaje positivo (sí, claro, dale, ok, quiero, me interesa, etc.):

1. El webhook de WhatsApp llama a `handleReactivationReply()`.
2. Detecta la respuesta positiva con regex: `/(sí|si|yes|claro|dale|ok|bueno|quiero|me interesa|adelante|perfecto|vamos|listo)/i`
3. Busca la campaña `sent` más reciente para ese teléfono.
4. Actualiza la campaña a `responded` con `responded_at`.
5. Envía mensaje de confirmación al paciente.
6. Crea una tarea en el Copiloto con prioridad `high`.

## Contenido de los mensajes

### Paso 1 (mensaje de bienvenida)
```
¡Hola [Nombre]! 🌟 Te saludamos desde [clínica].

Ha pasado un tiempo desde tu última visita y queremos que sepas que estamos aquí para seguir cuidándote.

¿Te gustaría agendar una cita próximamente? Responde *SÍ* y con gusto te ayudamos a encontrar el horario ideal. 😊
```

### Paso 2 (follow-up 7 días después)
```
¡Hola [Nombre]! 👋 Te escribimos nuevamente desde [clínica].

Queremos asegurarnos de que puedas acceder fácilmente a tu próxima cita. Tienes prioridad en nuestros horarios disponibles.

¿Podemos ayudarte a agendar hoy? Solo responde *SÍ* y te contactamos enseguida.
```

### Mensaje de confirmación (cuando responde)
```
¡Perfecto, [Nombre]! 🙌 Alguien de nuestro equipo en [clínica] se comunicará contigo muy pronto para coordinar tu cita.

¡Gracias por confiar en nosotros!
```

### Tarea de Copiloto generada
- **Título:** `Agendar cita — [Nombre] respondió a campaña de reactivación`
- **Descripción:** `El paciente respondió positivamente al mensaje de reactivación (paso [1 o 2]). Contactar para confirmar horario.`
- **Prioridad:** `high`
- **Fuente:** `reactivation`

## Configuración

- El umbral de inactividad está fijado en **90 días** (no configurable por UI).
- El período de exclusión por contacto reciente está fijado en **30 días**.
- El límite de pacientes por ejecución es **20** (máximo 50, configurable en el body del POST).
- El período de espera entre paso 1 y paso 2 es **7 días**.

## Tablas de BD involucradas

| Tabla                     | Uso                                                       |
|---------------------------|-----------------------------------------------------------|
| `patients`                | Pacientes elegibles: `last_visit_date`, `status`, `phone` |
| `appointments`            | Para excluir pacientes con citas futuras                  |
| `reactivation_campaigns`  | Registro de campañas enviadas por paciente y paso        |
| `organizations`           | Nombre de la clínica                                     |
| `copilot_tasks`           | Tareas creadas cuando el paciente responde                |

## Archivos clave

| Archivo                                          | Propósito                                            |
|--------------------------------------------------|------------------------------------------------------|
| `lib/whatsapp/reactivation-messages.ts`          | Builders de mensajes y detector de respuesta positiva |
| `lib/whatsapp/reactivation-reply.ts`             | Handler que procesa la respuesta y crea tarea        |
| `app/api/internal/reactivation/route.ts`         | Endpoint CRON para pasos 1 y 2                       |
| `app/(dashboard)/analytics/reactivation/page.tsx`| Dashboard de embudo de reactivación                  |
