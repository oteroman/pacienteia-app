# Backfill Inteligente de Slots

## ¿Qué es?

Cuando una cita se cancela o termina en no-show, el sistema detecta automáticamente el slot liberado, identifica candidatos calificados entre los pacientes existentes, y les envía un mensaje de WhatsApp ofreciéndoles ese espacio. El paciente solo responde "Sí" para confirmarlo.

**Objetivo:** Llenar huecos en la agenda en tiempo real, recuperando revenue que de otro modo se pierde.

---

## Flujo completo

```
Cita cancelada / no-show
        │
        ▼
cancelAppointment() o updateAppointmentStatus(status='cancelled'|'no_show')
        │
        ▼
triggerBackfill() — lib/backfill/index.ts
        │
        ├── findCandidates() → puntúa hasta 5 candidatos
        │         │
        │         ├── Fuente 1: pacientes con mismo tratamiento previo
        │         ├── Fuente 2: intakes con solicitud de cita abierta
        │         └── Fuente 3: pacientes en campaña de reactivación activa
        │
        ├── Crea copilot_task para el candidato #1
        │
        ├── Envía WhatsApp a los 3 mejores candidatos (fire & forget)
        │         │
        │         ▼
        │    "Hola María 👋 Tenemos disponibilidad de última hora para
        │     Botox el martes 14 de mayo a las 15:00.
        │     ¿Te gustaría tomar este espacio? Responde SÍ para confirmarte 😊"
        │
        └── Guarda slot_opening con status='open' + notified_phones[]
                │
        Paciente responde "Sí" (cualquier variante)
                │
                ▼
        handleBackfillReply() — lib/whatsapp/backfill-reply.ts
                │
                ├── Verifica: ¿hay un slot abierto donde este teléfono está en notified_phones?
                ├── Marca slot_opening.status = 'filled'
                └── Envía confirmación WhatsApp
```

---

## Algoritmo de Scoring de Candidatos

Cada candidato recibe un score entre 0 y 100 según estas reglas:

### Fuentes y scores base

| Fuente | Score base | Descripción |
|--------|-----------|-------------|
| Mismo tratamiento en <1 año | 30 | Paciente que ya se hizo el mismo tratamiento |
| Solicitud de cita abierta (intake) | 25 | Lead que pidió cita y aún no tiene una |
| En campaña de reactivación activa | 35 | Ya recibió un mensaje warm, más propenso a responder |

### Bonificaciones

| Condición | Bonus | Notas |
|-----------|-------|-------|
| Visita reciente (<90 días) | +15 | Indicador de relación activa |
| Está en waitlist (`on_waitlist=true`) | +10 | Ya expresó interés explícito |
| Slot urgente (<48h) | +5 | La urgencia aumenta la relevancia del mensaje |
| Ya en el mapa + fuente 2 (intake) | +15 adicional | Señal doble: historia + intención |
| Ya en el mapa + fuente 3 (reactivación) | +20 adicional | Señal más fuerte: ya está "calentado" |

### Resultado

- Se eligen los 5 mejores candidatos (máx. score 100)
- Se envían WhatsApp a los 3 primeros
- Se crea copilot_task para el primero

---

## Tablas involucradas

### `slot_openings`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `organization_id` | UUID | FK a organizations (multi-tenant) |
| `branch_id` | UUID | FK a branches |
| `appointment_id` | UUID | Cita que liberó el slot (nullable) |
| `treatment_type` | TEXT | Tipo de tratamiento del slot |
| `slot_start` | TIMESTAMPTZ | Fecha/hora del slot libre |
| `slot_end` | TIMESTAMPTZ | Fin del slot (opcional) |
| `reason_opened` | TEXT | `cancellation`, `no_show`, `reschedule`, `manual`, `gap_detected` |
| `status` | TEXT | `open`, `filled`, `expired` |
| `candidates` | JSONB | Array de candidatos con score y razones |
| `candidate_count` | INT | Cantidad de candidatos encontrados |
| `notified_phones` | JSONB | Teléfonos a los que se envió WhatsApp |
| `selected_patient_id` | UUID | Paciente que tomó el slot (cuando filled) |
| `fill_attempts` | INT | Veces que se intentó llenar |
| `staff_task_id` | UUID | Copilot task creada para el equipo |
| `filled_at` | TIMESTAMPTZ | Cuándo se llenó el slot |
| `notes` | TEXT | Notas adicionales |

### `patients.on_waitlist`

Columna booleana en `patients` que indica si el paciente pidió explícitamente ser avisado de disponibilidades. Se activa manualmente desde la ficha del paciente o desde el módulo de leads.

---

## Archivos clave

| Archivo | Función |
|---------|---------|
| `lib/backfill/index.ts` | Core: `triggerBackfill()`, `findCandidates()`, `fetchBackfillDashboard()`, `fillSlot()`, `expireSlot()` |
| `lib/whatsapp/backfill-reply.ts` | `handleBackfillReply()`: detecta "Sí" y cierra el slot |
| `app/(dashboard)/backfill/page.tsx` | Dashboard de slots: abiertos, llenados hoy, fill rate 30 días |
| `app/actions/appointments.ts` | `cancelAppointment()` y `updateAppointmentStatus()` disparan `triggerBackfill()` |
| `app/api/whatsapp/webhook/route.ts` | Llama `handleBackfillReply()` en cada mensaje entrante |
| `supabase/migrations/20260512000007_backfill_v2.sql` | Tabla `slot_openings` multi-tenant con `notified_phones` |

---

## Dashboard de Backfill

Ruta: `/backfill`

Muestra:
- **Stats globales:** slots abiertos hoy, llenados hoy, fill rate (30 días), total de slots
- **Slots abiertos:** lista con tratamiento, fecha/hora, candidatos encontrados, cuántos recibieron WhatsApp
- **Llenados hoy:** historial de éxitos del día

---

## Detección de respuesta positiva

El handler acepta las siguientes variantes (case-insensitive, ignora espacios/puntuación):

```
sí, si, dale, claro, va, ok, sí!, si!, me apunto, quiero, acepto, perfecto, confirmo, listo
```

Si el mismo paciente tiene un slot de reactivación y un slot de backfill abiertos, **ambos handlers corren independientemente**. El backfill handler valida que el teléfono esté en `notified_phones` del slot antes de marcarlo filled.

---

## Cómo activar backfill manual

Desde la página `/backfill` (pendiente implementar): botón "Crear slot manual" que abre un formulario con tipo de tratamiento y fecha/hora. Esto llama `triggerBackfill` con `reasonOpened: 'manual'`.

---

## Métricas clave a monitorear

| Métrica | Descripción | Objetivo |
|---------|-------------|---------|
| Fill rate | % de slots abiertos que se llenan | >30% |
| Time-to-fill | Tiempo desde apertura hasta llenado | <2 horas |
| Candidate hit rate | % de candidatos que responden | >15% |
| WhatsApp delivery rate | % de mensajes entregados | >95% |
