# 14 — Auto-Agendamiento desde WhatsApp

Flujo conversacional completo que permite a un paciente agendar su propia cita por WhatsApp sin intervención del staff.

---

## Concepto

Cuando el NLU detecta que un paciente quiere una cita nueva (`appointment_request`), el sistema inicia automáticamente un flujo de 2 pasos: primero le ofrece un menú numerado de servicios, luego le propone los próximos horarios disponibles. Si el paciente elige, la cita se crea directamente en la base de datos.

**Diferenciador:** no es un chatbot con reglas fijas ni un link a un formulario externo. Es una conversación WhatsApp nativa, en el mismo hilo donde el paciente ya está hablando, sin salir de la app.

---

## Flujo Completo

```
NLU detecta appointment_request (confidence: medium/high)
        │
        ▼
startBookingFlow()
        │
        ▼
WA: "Hola Lucía! ¿Cuál servicio te interesa?
     1. Botox
     2. Limpieza facial
     3. Tratamiento antiacné
     Responde con el número de tu preferencia."
        │
        ▼ (paciente responde "2")
handleBookingFlow() → handleServiceChoice()
        │
        ├─ findSlotsAcrossProfessionals() ── busca slots disponibles en todos los profesionales
        │
        ▼
WA: "Aquí tienes los próximos horarios para Limpieza facial 📅
     → Escribe 1 · Lun 15/05 · 10:00 AM
     → Escribe 2 · Mar 16/05 · 3:00 PM
     → Escribe 3 · Mié 17/05 · 11:30 AM"
        │
        ▼ (paciente responde "1")
handleSlotChoice()
        │
        ├─ ¿patient_id conocido?
        │       ├─ SÍ → INSERT INTO appointments (status: confirmed)
        │       │        WA: "✅ ¡Listo, Lucía! Tu cita de Limpieza facial fue agendada para el lunes 15/05 a las 10:00 AM"
        │       └─ NO → INSERT INTO copilot_tasks (priority: high)
        │                WA: "Gracias! Hemos registrado tu solicitud... Un agente confirmará tu cita en breve."
        │
        ▼
clearFlow() — booking_flow = null
```

---

## Estado de la Conversación (`booking_flow` JSONB)

El estado se guarda en `conversations.booking_flow` para persistir entre mensajes del mismo paciente.

```typescript
interface BookingFlowState {
  step:                 'awaiting_service' | 'awaiting_slot'
  services?:            { name: string; durationMin: number }[]
  selectedService?:     string
  selectedDurationMin?: number
  professionalId?:      string
  slots?:               SlotOption[]
  startedAt:            string  // ISO timestamp — para calcular TTL
}
```

**TTL:** 30 minutos desde `startedAt`. Si el paciente no responde en ese tiempo, el flow se descarta silenciosamente al siguiente mensaje.

**Migración:** `supabase/migrations/20260512000010_booking_flow.sql`

```sql
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS booking_flow            JSONB,
  ADD COLUMN IF NOT EXISTS booking_flow_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_booking_flow
  ON public.conversations (organization_id, booking_flow_updated_at DESC)
  WHERE booking_flow IS NOT NULL;
```

---

## Implementación — Archivos Clave

### `lib/whatsapp/booking-flow.ts`

**`startBookingFlow(opts)`** — llamada desde NLU
- Obtiene servicios activos + nombre de la organización
- Si no hay servicios: envía mensaje de "un agente te contactará" y no inicia el flow
- Envía menú numerado + guarda `BookingFlowState` en `conversations.booking_flow`

**`handleBookingFlow(opts)`** — llamada desde webhook
- Busca conversación con `booking_flow IS NOT NULL` para ese teléfono
- Verifica TTL — si expiró, limpia y retorna `false`
- Parsea la respuesta como número entero
- Delega a `handleServiceChoice` o `handleSlotChoice` según el step
- Retorna `boolean` — si `true`, el webhook retorna 200 inmediatamente sin pasar por otros handlers

**`findSlotsAcrossProfessionals(opts)`**
- Obtiene todos los profesionales activos del branch
- Para cada profesional, llama `findAvailableSlots()` (de `lib/whatsapp/reschedule.ts`)
- Deduplica por `utcIso` (dos profesionales pueden tener el mismo slot disponible)
- Retorna los N primeros ordenados cronológicamente

### `app/api/whatsapp/webhook/route.ts`

**Orden de handlers (crítico):**

```typescript
// 1. PRIMERO — booking flow intercepta respuestas numéricas activas
const bookingHandled = await handleBookingFlow({ ... })
if (bookingHandled) return new NextResponse(null, { status: 200 })

// 2. Reagendamiento (también intercepta números)
const rescheduleHandled = await handleRescheduleSelection({ ... })

// 3. Confirmación de recordatorio
if (!rescheduleHandled) await handleReminderReply({ ... })

// 4-6. Follow-up, reactivación, backfill (independientes)
await handleFollowupReply({ ... })
await handleReactivationReply({ ... })
await handleBackfillReply({ ... })

// 7. NLU (fire & forget)
runNluPipeline({ ... }).catch(...)
```

El booking flow **debe ser el primero** porque intercepta "1", "2", "3" y esos mismos números los usan reschedule y reminder. Si el booking flow no tiene un flow activo para ese teléfono, retorna `false` inmediatamente sin costo.

---

## Descubrimiento de Slots

Reutiliza la lógica existente de reagendamiento (`lib/whatsapp/reschedule.ts → findAvailableSlots`):

1. Lee `doctor_schedules` del profesional (disponibilidad semanal)
2. Lee `schedule_blocks` (bloqueos de fecha)
3. Lee `appointments` futuras del profesional (slots ocupados)
4. Genera candidatos de 30 min en 30 min dentro del horario configurado
5. Excluye candidatos que colisionen con citas existentes
6. Retorna los primeros N disponibles

Para el auto-agendamiento, `findSlotsAcrossProfessionals` itera todos los profesionales y presenta los mejores 3 sin importar cuál los cubra.

---

## Casos Especiales

### Paciente nuevo (no en el sistema)

Si `conversations.patient_id` es `null`, no se puede crear una appointment (FK constraint). En ese caso:

1. Se crea una `copilot_task` con:
   - Título: "Nueva cita solicitada — +51999..."
   - Descripción: servicio, fecha/hora solicitada, teléfono
   - Priority: `high`
   - Source: `booking_flow`
2. El paciente recibe: "Hemos registrado tu solicitud... Un agente confirmará tu cita en breve."

El staff ve la tarea en el copiloto, crea el paciente y la cita manualmente.

### Sin slots disponibles

Si `findSlotsAcrossProfessionals` retorna 0 slots, el flow se cierra y el paciente recibe:
"...no encontramos horarios disponibles para *X* en los próximos días 😔. Un agente te contactará pronto para coordinar."

### Respuesta inválida

Si el paciente escribe algo que no es un número válido (o fuera de rango), el sistema le recuerda las opciones:
"[Nombre], por favor responde con un número (1, 2, 3) para confirmar tu horario."
El flow sigue activo (no se cierra).

---

## Notas para Desarrolladores

- **Booking flow vs reschedule flow:** ambos usan respuestas numéricas pero son independientes. El booking flow vive en `conversations.booking_flow` JSONB; el reschedule usa `reschedule_pending` (columna separada). No hay colisión si se siguen los handlers en orden.
- **`professionalId` en el state:** cuando hay múltiples profesionales, el state guarda el `professionalId` del primer slot encontrado. Esto es un simplificación — la cita se asigna a ese profesional aunque el paciente haya elegido un slot de otro. En una mejora futura, `slots[]` debería incluir `professionalId` por slot y usarse en el insert.
- **Idempotencia:** si el mismo paciente inicia el flow dos veces (dos mensajes "quiero cita"), el segundo `startBookingFlow` sobreescribe el JSONB. El flow previo se pierde. Esto es aceptable porque el TTL es de 30 min y el caso es raro.
- **Formato de horarios:** usa `formatWeekdayDayLima` y `formatTimeLima` de `lib/whatsapp/reminders.ts` para mostrar la fecha/hora en zona Lima (UTC-5, sin DST).
