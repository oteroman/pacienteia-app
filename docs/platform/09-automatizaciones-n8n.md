# Configuración de Automatizaciones (n8n)

## ¿Qué hace?

n8n es el motor de automatizaciones de PacienteIA. Ejecuta los workflows según un calendario (CRON) y llama a los endpoints internos de la plataforma para enviar mensajes de WhatsApp y realizar acciones automatizadas. Sin n8n activo, los recordatorios, encuestas y campañas de reactivación no se envían.

## Workflows activos e inactivos

| Workflow              | ID n8n               | Estado           | Horario (Lima, UTC-5)                   |
|-----------------------|----------------------|------------------|-----------------------------------------|
| Recordatorio 24h      | `Yp1PyCvHvMBuzySR`  | Activo           | Todos los días a las 8:00 AM (`0 13 * * *` UTC) |
| Recordatorio 2h       | `zrg6OeyKQDxsScpq`  | Pendiente activar | Cada hora de 7:00 AM a 3:00 PM         |
| Encuesta post-cita    | `GQBK1dLS4PL6k5Yi`  | Activo           | Cada hora (`0 * * * *` UTC)             |
| Reactivación paso 1   | `re29X6GI7IW9fooG`  | Pendiente activar | Lunes a viernes a las 10:00 AM          |
| Reactivación paso 2   | `h8gdAFoCKl1nT2Wy`  | Pendiente activar | Lunes a las 10:00 AM                    |

## Cómo funciona cada workflow

### Recordatorio 24h

1. n8n se activa a las 8:00 AM Lima
2. Para cada sucursal configurada, hace POST a:
   ```
   POST https://app.pacienteia.com/api/internal/appointment-reminders
   Authorization: Bearer <CRON_SECRET_ROTAR>
   Body: { "clinic_id": "<uuid>", "branch_id": "<uuid>", "type": "24h" }
   ```
3. El endpoint busca citas para mañana y envía recordatorios
4. Retorna un resumen: `{ date, type, total, sent, skipped, failed }`

### Recordatorio 2h

Mismo endpoint que el 24h pero con `"type": "2h"`. Se ejecuta cada hora porque la ventana de detección es dinámica (citas en la próxima 1-2 horas desde el momento de ejecución).

### Encuesta post-cita

1. n8n se activa cada hora
2. Para cada sucursal, hace POST a:
   ```
   POST https://app.pacienteia.com/api/internal/appointment-followups
   Authorization: Bearer <CRON_SECRET_ROTAR>
   Body: { "clinic_id": "<uuid>", "branch_id": "<uuid>" }
   ```
3. El endpoint busca citas completadas en la ventana de 4-10 horas atrás
4. Envía la encuesta de satisfacción a los que no la han recibido aún

### Reactivación paso 1

1. n8n se activa L-V a las 10:00 AM Lima
2. Para cada sucursal, hace POST a:
   ```
   POST https://app.pacienteia.com/api/internal/reactivation
   Authorization: Bearer <CRON_SECRET_ROTAR>
   Body: { "clinic_id": "<uuid>", "branch_id": "<uuid>", "step": 1 }
   ```
3. Selecciona hasta 20 pacientes inactivos hace 90+ días
4. Envía el mensaje de bienvenida

### Reactivación paso 2

Mismo endpoint con `"step": 2`. Se ejecuta los lunes para dar seguimiento a pacientes que no respondieron en 7 días.

## Autenticación de los endpoints

Todos los endpoints internos aceptan dos formas de autenticación:
- **Header:** `Authorization: Bearer <CRON_SECRET>`
- **Query param:** `?key=<ADMIN_DASHBOARD_SECRET>`

La variable `CRON_SECRET` tiene el valor `<CRON_SECRET_ROTAR>`.

## Endpoint de inspección (dry-run)

El endpoint de recordatorios tiene un método GET para verificar qué se enviaría sin hacer envíos reales:

```
GET /api/internal/appointment-reminders?clinic_id=<uuid>&date=2026-05-15&key=<secret>
```

Devuelve la lista de citas encontradas con el mensaje que se enviaría.

## Cola de webhooks (webhook_queue)

Adicionalmente, cuando llega un mensaje de WhatsApp entrante, se guarda en la tabla `webhook_queue`. n8n puede suscribirse a esta cola para procesar los mensajes entrantes y ejecutar flujos adicionales (por ejemplo, respuestas automáticas, clasificación, etc.).

## Activar los workflows pendientes

Los workflows de reactivación y recordatorio 2h están creados en n8n pero en estado inactivo. Para activarlos:
1. Ingresar al panel de n8n
2. Buscar el workflow por ID
3. Activar el toggle de estado del workflow

## Tablas de BD involucradas

| Tabla             | Uso                                                    |
|-------------------|--------------------------------------------------------|
| `webhook_queue`   | Cola de mensajes entrantes de WhatsApp para n8n       |
| `appointment_reminders` | Evita duplicados en recordatorios              |
| `appointment_followups` | Evita duplicados en encuestas                  |
| `reactivation_campaigns` | Registro de campañas enviadas                 |

## Archivos clave

| Archivo                                                    | Propósito                                    |
|------------------------------------------------------------|----------------------------------------------|
| `app/api/internal/appointment-reminders/route.ts`          | Endpoint de recordatorios (24h y 2h)        |
| `app/api/internal/appointment-followups/route.ts`          | Endpoint de encuesta post-cita               |
| `app/api/internal/reactivation/route.ts`                   | Endpoint de reactivación (paso 1 y 2)       |
| `app/api/internal/performance-alerts/route.ts`             | Endpoint de alertas de rendimiento           |
| `app/api/internal/renewal-signals/route.ts`                | Endpoint de señales de renovación            |
| `app/api/whatsapp/webhook/route.ts`                        | Recibe webhooks de Meta y encola en n8n      |
