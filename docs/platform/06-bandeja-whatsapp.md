# Bandeja Unificada WhatsApp

## ¿Qué hace?

La bandeja unificada es el centro de comunicaciones de la clínica. Muestra en un solo lugar todas las conversaciones activas de WhatsApp y los leads pendientes de atención. El staff puede leer y responder mensajes sin salir de la plataforma, ver el historial completo de cada contacto y asignarse conversaciones para gestionarlas.

## Cómo funciona

### Estructura de la pantalla

La pantalla `/inbox` está dividida en dos paneles:

**Panel izquierdo (lista):**
- Sección "WhatsApp": conversaciones activas ordenadas por último mensaje
- Sección "Leads & Formularios": intakes/leads pendientes con indicador de SLA
- Botón "+ Nuevo" para crear un intake manual

**Panel derecho (hilo):**
- Al seleccionar una conversación, muestra el historial de mensajes
- Burbuja izquierda (gris): mensajes recibidos del paciente
- Burbuja derecha (color de marca): mensajes enviados por la clínica
- Compositor de mensaje al fondo
- Botones: "Asignarme", "Resolver", "Ver paciente"

### Cómo llegan los mensajes de WhatsApp

1. Meta envía un webhook al endpoint `/api/whatsapp/webhook/route.ts`
2. El sistema valida la firma HMAC del webhook
3. Si el número ya tiene una conversación abierta, agrega el mensaje al hilo
4. Si es la primera vez que ese número escribe, crea una nueva conversación
5. Guarda el mensaje en la tabla `messages` y actualiza `conversations` (last_message, unread_count)
6. Encola el evento en `webhook_queue` para procesamiento asíncrono por n8n
7. El mensaje también activa los handlers de recordatorios, post-cita y reactivación

### Envío de mensajes

1. El staff escribe el mensaje en el compositor y presiona Enter (o Shift+Enter para nueva línea)
2. Se llama a la Server Action `sendMessage()`
3. `sendMessage()` usa `sendWhatsAppText()` para enviar via Meta Cloud API
4. El mensaje se guarda en la tabla `messages` con `direction = 'outbound'`
5. Se actualiza `last_message_at` y `last_message_preview` en `conversations`

### Tiempo real

La página tiene un componente `InboxRealtime` que se suscribe a cambios en Supabase Realtime para recibir nuevos mensajes sin recargar la página. Al llegar un mensaje nuevo en la conversación activa, el hilo se actualiza automáticamente.

### Gestión de conversaciones

| Acción          | Resultado                                                    |
|-----------------|--------------------------------------------------------------|
| Asignarme       | Asigna la conversación al usuario logueado (`assigned_to`)  |
| Resolver        | Cambia status a `resolved`, conversación sale de la lista   |
| Ver paciente    | Enlace al perfil del paciente si está vinculado             |

Las conversaciones resueltas no aparecen en la lista (solo se muestran las no resueltas). El límite es 50 conversaciones por carga.

### Historial de mensajes

Se cargan hasta 100 mensajes por conversación, ordenados del más antiguo al más reciente. Los mensajes del tipo media (imagen, audio, etc.) que no tengan texto muestran el tipo entre corchetes, ej: `[image]`.

El check de estado del mensaje outbound:
- `✓` (un tick): enviado
- `✓✓` (dos ticks): entregado o leído

## Estados de las conversaciones

| Status     | Descripción                                           |
|------------|-------------------------------------------------------|
| `open`     | Sin asignar, esperando atención                      |
| `assigned` | Asignada a un miembro del staff                      |
| `resolved` | Cerrada, no aparece en la bandeja activa             |

## Tablas de BD involucradas

| Tabla            | Uso                                                        |
|------------------|------------------------------------------------------------|
| `conversations`  | Hilos de WhatsApp: estado, último mensaje, sin leer        |
| `messages`       | Mensajes individuales inbound/outbound                    |
| `patients`       | Para vincular conversación con paciente existente         |
| `intakes`        | Leads pendientes mostrados en la sección "Leads & Formularios" |

## Archivos clave

| Archivo                                               | Propósito                                         |
|-------------------------------------------------------|---------------------------------------------------|
| `lib/inbox/conversations.ts`                          | `fetchConversations`, `fetchConversation`, `fetchConversationMessages` |
| `app/actions/conversations.ts`                        | `sendMessage`, `resolveConversation`, `markConversationRead`, `assignConversationToMe` |
| `app/(dashboard)/inbox/page.tsx`                      | UI principal: layout dos paneles + renderizado    |
| `app/(dashboard)/inbox/InboxRealtime.tsx`             | Suscripción Supabase Realtime para mensajes nuevos |
| `app/(dashboard)/inbox/ScrollToBottom.tsx`            | Auto-scroll al último mensaje                    |
| `app/(dashboard)/inbox/conversations/[id]/page.tsx`   | Vista de hilo individual (ruta alternativa)       |
| `app/api/whatsapp/webhook/route.ts`                   | Recibe mensajes entrantes de Meta                |
| `lib/whatsapp/send.ts`                                | `sendWhatsAppText()` via Meta Cloud API          |
| `lib/whatsapp/extract.ts`                             | `extractInboundMessage()` — parsea payload Meta  |
