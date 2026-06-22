# 13 — NLU Avanzado en Conversaciones WhatsApp

Clasificación de intención en tiempo real sobre cada mensaje entrante de WhatsApp usando Gemini, con acciones automáticas y visibilidad en el dashboard.

---

## Concepto

Cada mensaje que llega por WhatsApp pasa por un pipeline de NLU (Natural Language Understanding) que determina qué quiere el paciente. A diferencia de reglas fijas ("si dice 'cancelar' → intent cancelación"), Gemini entiende lenguaje natural en español peruano: coloquialismos, ortografía informal, contexto de mensajes anteriores.

**Diferenciador clave:** los sistemas de la competencia tienen reglas estáticas. PacienteIA entiende "no voy a poder ir mañana" como intención de cancelar aunque la palabra "cancelar" no aparezca.

---

## Intents Detectados

| Intent | Descripción | Acción automática |
|--------|-------------|-------------------|
| `cancel_intent` | Quiere cancelar su cita | Tarea copilot (priority: medium) |
| `reschedule_intent` | Quiere cambiar fecha/hora | Solo badge — el flujo de reagendamiento lo maneja `handleRescheduleSelection` |
| `price_inquiry` | Pregunta precios o promociones | Auto-respuesta con catálogo de servicios |
| `dissatisfaction` | Queja o mala experiencia | Tarea copilot (priority: high) + auto-respuesta |
| `medical_urgency` | Dolor intenso o emergencia real | Tarea copilot (priority: high) + auto-respuesta urgente |
| `appointment_request` | Quiere agendar una cita nueva | Inicia flujo de auto-agendamiento (ver doc 14) |
| `general_inquiry` | Horarios, ubicación, servicios | Solo badge |
| `positive_response` | Confirmación, agradecimiento | Solo badge |
| `none` | Saludo casual, emoji, sin intención | Sin acción |

---

## Arquitectura

### Pipeline

```
Mensaje entrante WhatsApp
        │
        ▼ (después de guardar en messages + conversations)
runNluPipeline() — fire & forget (no bloquea el 200 a Meta)
        │
        ├─ 1. Fetch últimos 5 mensajes del hilo (contexto)
        ├─ 2. classifyMessage(body, history) → Gemini API
        ├─ 3. UPDATE messages SET detected_intent, intent_confidence, intent_summary
        ├─ 4. UPDATE conversations SET last_intent, last_intent_at
        │
        └─ 5. Acción por intent:
              ├─ price_inquiry → handlePriceInquiry() → envía catálogo
              ├─ appointment_request → startBookingFlow() → menú de servicios
              ├─ cancel_intent / dissatisfaction / medical_urgency → copilot_task + AUTO_REPLY
              └─ otros → solo persistencia
```

### Modelo de datos

**Migración:** `supabase/migrations/20260512000009_message_nlu.sql`

```sql
-- En tabla messages:
detected_intent    TEXT     -- intent clasificado
intent_confidence  TEXT     -- 'high' | 'medium' | 'low'
intent_summary     TEXT     -- frase corta en español

-- En tabla conversations:
last_intent        TEXT     -- último intent no-trivial para badge en inbox
last_intent_at     TIMESTAMPTZ
```

**Índice:** `idx_messages_intent ON messages(organization_id, detected_intent, created_at DESC) WHERE detected_intent IS NOT NULL` — soporta filtros del inbox.

---

## Implementación — Archivos Clave

### `lib/whatsapp/nlu.ts`

**`classifyMessage(body, recentMessages)`**
- Construye un prompt con contexto de los últimos 4 mensajes del hilo
- Llama a `gemini-2.5-flash` con JSON-mode implícito
- Parsea el JSON (strippea code fences si el modelo las agrega)
- Retorna `NluResult | null`

**`runNluPipeline(opts)`**
- Ejecutado en fire-and-forget desde el webhook
- Persiste el resultado en la BD
- Ejecuta la acción correspondiente al intent
- Evita duplicados de tareas copilot: verifica `copilot_tasks` con `ilike('description', '%conversationId%')` antes de insertar

**`handlePriceInquiry(sb, opts)`**
- Obtiene servicios activos + nombre de la organización
- Formatea mensaje: `• *Nombre*: S/ XX · YY min`
- Envía por WhatsApp y retorna (no crea tarea)

### `app/api/whatsapp/webhook/route.ts`

```typescript
// NLU: fire & forget — Meta ya recibió su 200
if (conv?.id && messageId) {
  runNluPipeline({ ... }).catch((err) => console.error('[nlu]', err))
}
```

---

## Visualización en el Dashboard

### Inbox — Lista de conversaciones

En `app/(dashboard)/inbox/page.tsx`:

- **Filtros** (tabs horizontales):
  - Todos
  - Urgentes (medical_urgency + dissatisfaction) — badge rojo
  - Cancelan (cancel_intent) — badge naranja
  - Citas (appointment_request) — badge verde
  - Precios (price_inquiry) — badge azul

- **Badge de intent** junto al preview del último mensaje en cada conversación
- Contador de resultados al filtrar

### Hilo de conversación

En `app/(dashboard)/inbox/conversations/[id]/page.tsx`:

- **Badge `last_intent`** en el header de la conversación (junto al nombre del paciente)
- **Por mensaje inbound** con intent detectado: label + frase resumen debajo de la burbuja

---

## Auto-Respuestas

### Catálogo de precios (`price_inquiry`)

Solo se ejecuta si `confidence !== 'low'`. Envía:

```
Hola! Aquí tienes nuestros servicios y tarifas 😊

*Clínica XYZ*

• *Botox*: S/ 350 · 30 min
• *Limpieza facial*: S/ 120 · 60 min
...

¿Te gustaría agendar una cita? Escríbenos y con gusto te ayudamos.
```

### Urgencia médica (`medical_urgency`, confidence: high)

```
🚨 Hemos recibido tu mensaje. Un miembro de nuestro equipo te contactará en los próximos minutos. Si es una emergencia inmediata, llama al número de urgencias.
```

### Insatisfacción (`dissatisfaction`, confidence: high)

```
Lamentamos mucho tu experiencia. Nuestro equipo revisará tu caso y te contactará muy pronto para resolverlo. Gracias por avisarnos. 🙏
```

---

## Notas para Desarrolladores

- **Fire-and-forget obligatorio:** el webhook debe retornar 200 a Meta en < 5s. La clasificación Gemini puede tomar 1-3s. Por eso `runNluPipeline` se lanza sin `await`.
- **Contexto de conversación:** el prompt incluye los últimos 4 mensajes del hilo (combinando inbound/outbound) para que Gemini entienda el contexto. Sin esto, una respuesta "sí" a un recordatorio podría clasificarse como `positive_response` cuando en realidad es una confirmación.
- **Deduplicación de tareas:** la condición `ilike('%conversationId%')` es intencional — el conversationId se embede en el `description` de la tarea. Así evitamos spam si el paciente manda múltiples mensajes de cancelación seguidos.
- **`appointment_request` no genera tarea copilot** — el flujo de auto-agendamiento lo maneja directamente (ver doc 14). Si el flujo falla, el sistema no crea una tarea de respaldo; se puede agregar en el futuro.
