# Seguimiento Post-Cita y Escudo de Reputación

## ¿Qué hace?

Después de cada cita completada, PacienteIA envía automáticamente una encuesta de satisfacción por WhatsApp. Los pacientes satisfechos (calificación 4-5) reciben un enlace para dejar una reseña en Google. Los insatisfechos (calificación 1-3) reciben un mensaje de atención personal y se genera una alerta interna para que el staff actúe antes de que la queja llegue a Google. Este mecanismo se llama "escudo de reputación".

## Cómo funciona

### Paso 1: Envío de encuesta post-cita

1. El workflow n8n `GQBK1dLS4PL6k5Yi` se ejecuta cada hora.
2. n8n hace un POST a `/api/internal/appointment-followups`.
3. El endpoint busca citas con status `completed` cuyo `scheduled_at` esté en la ventana de **4 a 10 horas atrás**.
4. Excluye citas que ya tienen un follow-up registrado (idempotente).
5. Para cada cita, envía la encuesta de satisfacción por WhatsApp.
6. Registra el envío en `appointment_followups`.

La ventana de 4-10 horas da tiempo para que el paciente llegue a casa y procese su experiencia antes de recibir la encuesta.

### Paso 2: Respuesta del paciente

Cuando el paciente responde con un número del 1 al 5:

1. El webhook de WhatsApp recibe el mensaje y llama a `handleFollowupReply()`.
2. Valida que el mensaje sea exactamente un dígito del 1 al 5 (regex `^\s*([1-5])\s*$`).
3. Busca el follow-up `sent` más reciente para ese teléfono.
4. Actualiza el follow-up a `responded` con el rating y la hora.

### Paso 3: Routing según calificación (el "escudo")

**Calificación 4 o 5 (promotor) + URL de Google configurada:**
- Envía mensaje de agradecimiento con enlace directo a Google Reviews
- Marca `review_link_sent = true` para no enviar el link dos veces

**Calificación 4 o 5 (promotor) + sin URL de Google:**
- Envía mensaje de agradecimiento simple sin enlace

**Calificación 1, 2 o 3 (insatisfecho):**
- Envía mensaje de atención empático ("nuestro equipo revisará tu comentario")
- Crea una tarea en el Copiloto con prioridad `high` y fuente `reputation_alert`
- Marca `alert_created = true` para no crear la tarea dos veces

## Contenido de los mensajes

### Encuesta de satisfacción
```
¡Hola [Nombre]! 😊

Gracias por visitarnos hoy en *[clínica]*.

Queremos saber cómo estuvo tu atención de [tratamiento]. ¿Cómo la calificarías?

Responde solo con el número:
*5* — Excelente
*4* — Muy buena
*3* — Buena
*2* — Regular
*1* — Mala

Tu opinión nos ayuda a mejorar 🙏
```

### Mensaje para rating 4 o 5 (con Google Reviews)
```
🌟 ¡Muchas gracias, [Nombre]! Nos alegra saber que tuviste una excelente experiencia.

Si tienes un minuto, dejarnos una reseña en Google nos ayuda muchísimo a seguir mejorando:
[URL Google Reviews]

¡Hasta la próxima! ❤️ — *[clínica]*
```

### Mensaje para rating 1-3 (insatisfecho)
```
Gracias por compartir tu experiencia, [Nombre].

Tu opinión es muy importante para nosotros. Nuestro equipo revisará tu comentario y se pondrá en contacto contigo a la brevedad.

— *[clínica]*
```

### Tarea de Copiloto generada (rating 1-3)
- **Título:** `⚠️ Alerta de reputación: [Nombre] calificó [X]/5`
- **Descripción:** `El paciente [nombre completo] calificó su atención con [X]/5 en la encuesta post-cita. Requiere seguimiento inmediato.`
- **Prioridad:** `high`

## Configuración

- La URL de Google Reviews se configura en **Ajustes → WhatsApp** (campo `google_review_url` en `branch_whatsapp_config`).
- Si no está configurada, los pacientes satisfechos reciben solo el agradecimiento sin enlace.
- La lógica de routing (4-5 vs 1-3) es fija y no es configurable.

## NPS (Net Promoter Score)

El sistema calcula un NPS simplificado basado en las respuestas:
- **Promotores:** rating 4 o 5
- **Pasivos:** rating 3
- **Detractores:** rating 1 o 2

**Fórmula:** `NPS = (promotores - detractores) / total_respondidos × 100`

Esto se muestra en el dashboard de Analytics → Reputación.

## Tablas de BD involucradas

| Tabla                    | Uso                                                          |
|--------------------------|--------------------------------------------------------------|
| `appointments`           | Citas completadas para identificar candidatos a encuesta    |
| `appointment_followups`  | Tracking de encuestas enviadas, ratings y alertas           |
| `patients`               | Nombre del paciente para personalizar mensajes              |
| `organizations`          | Nombre de la clínica                                        |
| `branch_whatsapp_config` | URL de Google Reviews                                       |
| `copilot_tasks`          | Tareas de alerta creadas para ratings 1-3                   |

## Archivos clave

| Archivo                                                  | Propósito                                   |
|----------------------------------------------------------|---------------------------------------------|
| `lib/whatsapp/followups.ts`                              | Builders de mensajes de encuesta y respuestas |
| `lib/whatsapp/followup-reply.ts`                         | Handler del routing por rating              |
| `app/api/internal/appointment-followups/route.ts`        | Endpoint CRON para envío de encuestas       |
| `lib/analytics/reputation.ts`                            | Cálculo de NPS y estadísticas de reputación |
| `app/(dashboard)/analytics/reputation/page.tsx`          | Dashboard de reputación                     |
