# Recordatorios Automáticos de Citas

## ¿Qué hace?

PacienteIA envía recordatorios automáticos por WhatsApp a los pacientes antes de su cita: uno el día anterior (24 horas antes) y otro el mismo día (2 horas antes). Los pacientes pueden confirmar o solicitar un cambio de horario respondiendo con un número, sin tener que escribir texto libre.

## Cómo funciona

### Flujo del recordatorio de 24 horas

1. El workflow n8n `Yp1PyCvHvMBuzySR` se ejecuta todos los días a las 8:00 AM Lima (1:00 PM UTC).
2. n8n hace un POST a `/api/internal/appointment-reminders` con `type=24h`.
3. El endpoint busca todas las citas con status `scheduled` o `confirmed` para el día siguiente.
4. Excluye citas que ya tienen un recordatorio enviado de ese tipo (idempotente).
5. Para cada cita con teléfono válido, envía un mensaje WhatsApp con la mecánica de respuesta.
6. Registra el envío en la tabla `appointment_reminders`.

### Flujo del recordatorio de 2 horas

1. El workflow n8n `zrg6OeyKQDxsScpq` se ejecuta cada hora entre las 7:00 AM y 3:00 PM Lima (pendiente activar).
2. n8n hace un POST a `/api/internal/appointment-reminders` con `type=2h`.
3. El endpoint busca citas con `scheduled_at` en la ventana de 1h a 2h desde ahora.
4. Mismo proceso de deduplicación y envío que el recordatorio de 24h.

### Flujo de respuesta del paciente

Cuando el paciente responde al mensaje:

1. El webhook de WhatsApp (`/api/whatsapp/webhook/route.ts`) recibe el mensaje entrante.
2. Llama a `handleReminderReply()` para cada mensaje inbound.
3. Si el mensaje es exactamente `1` o `2` (y existe un recordatorio `sent` reciente para ese teléfono):

**Respuesta "1" (confirmar):**
- Actualiza el status de la cita a `confirmed`
- Actualiza el registro de recordatorio a `confirmed` con `responded_at`
- Envía mensaje de confirmación al paciente

**Respuesta "2" (reagendar):**
- Actualiza el registro de recordatorio a `reschedule_requested`
- Envía mensaje de reagendamiento al paciente
- La conversación queda abierta en la bandeja para que el staff la atienda

Cualquier otro mensaje es ignorado por el handler de recordatorios.

## Contenido de los mensajes

### Mensaje 24h (con industria != psicología)
```
Hola [Nombre] 😊

Te recordamos que mañana *[día fecha]* a las *[HH:MM]* tienes tu cita de *[tratamiento]* con *Dr. [nombre]* en *[clínica]*.

¿Podrás asistir?
→ Escribe *1* para confirmar ✅
→ Escribe *2* si necesitas cambiar el horario 📅
```

Para clínicas de psicología, el tipo de tratamiento se omite por privacidad.

### Mensaje 2h (recordatorio corto)
```
Hola [Nombre], ¡hoy es tu cita de *[tratamiento]*! 🙌

En unas horas te esperamos a las *[HH:MM]* con *Dr. [nombre]*. Recuerda llegar 5 min antes 😊
```

### Mensaje de confirmación (respuesta a "1")
```
✅ ¡Perfecto, [Nombre]! Tu cita está confirmada.

Te esperamos a las *[HH:MM]* en *[clínica]*.
```

### Mensaje de reagendamiento (respuesta a "2")
```
Entendido, [Nombre]. Con gusto buscamos otro horario para ti.

Un agente de *[clínica]* te escribirá pronto para coordinar 📅
```

## Configuración

- Los teléfonos se normalizan automáticamente al formato E.164 peruano (`51XXXXXXXXX`).
- La hora se muestra siempre en zona horaria Lima (`America/Lima`), formato 24h.
- Para clínicas de psicología (`industry = 'psicologia'`), el tipo de tratamiento se oculta en todos los mensajes.
- El nombre del doctor se muestra solo con el primer nombre para un tono más cálido.

## Tablas de BD involucradas

| Tabla                   | Uso                                                    |
|-------------------------|--------------------------------------------------------|
| `appointments`          | Citas a recordar: `scheduled_at`, `status`, `treatment_type` |
| `patients`              | Nombre y teléfono del paciente                        |
| `appointment_reminders` | Tracking de recordatorios enviados (deduplicación)     |
| `organizations`         | Nombre de la clínica e industria                      |
| `branch_whatsapp_config`| Token de WhatsApp para enviar mensajes                |

## Archivos clave

| Archivo                                                   | Propósito                                     |
|-----------------------------------------------------------|-----------------------------------------------|
| `lib/whatsapp/reminders.ts`                               | Builders de mensajes y utilidades de formato  |
| `lib/whatsapp/reminder-reply.ts`                          | Handler de respuestas "1" y "2"               |
| `app/api/internal/appointment-reminders/route.ts`         | Endpoint CRON (GET dry-run, POST envío real)  |
| `app/api/whatsapp/webhook/route.ts`                       | Recibe mensajes entrantes y despacha handlers |
