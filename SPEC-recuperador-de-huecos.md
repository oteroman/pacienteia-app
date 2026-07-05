# SPEC — Recuperador de Huecos (agente activo de backfill)

> **Objetivo de negocio:** convertir cancelaciones y no-shows en citas recuperadas de forma autónoma, y mostrar al dueño un contador de "S/ recuperados por PacienteIA" que justifique la suscripción en los primeros 14 días.
>
> **Para:** Claude Code, sobre el repo `pacienteia-app` (Next.js 15 App Router + Supabase + n8n).
> **Regla de oro:** construir SOBRE lo existente. No duplicar `lib/backfill/`, extenderlo.

---

## 1. Estado actual (verificado en el código)

Ya existe y NO se debe reconstruir:

- `public.slot_openings` (migración `20260508000004_operational_tables.sql`, v2 con `organization_id` + `branch_id`): ciclo de vida `open → filled/expired`, `candidates JSONB` con `{patientId, patientName, phone, score, scoreReasons[], waMessage}`, `fill_attempts`, `staff_task_id`.
- `public.appointment_rebooking` (v2): triggers `cancelled | no_show | no_response | reschedule_request`, outcomes `pending | rebooked | lost | escalated | no_response`.
- `lib/backfill/index.ts`: `findCandidates()` (scoring determinístico: base 30, +15 visita reciente, +10 waitlist, +20 quiere reagendar el tratamiento, +15 solicitud abierta, +5 slot urgente) y `buildWaMessage()`.
- `lib/backfill/gap-detection.ts` + cron `GET /api/internal/gap-detection` (diario 9AM Lima, días con <60% de ocupación → `triggerBackfill()`).
- `metrics_daily.estimated_revenue_recovered NUMERIC(10,2)` — la columna del contador ya existe, hoy nadie la escribe.
- Webhook WhatsApp entrante: `app/api/whatsapp/webhook/route.ts` → encola en `webhook_queue` y responde 200 (patrón a mantener).
- Envío WhatsApp saliente: vía n8n (`N8N_WEBHOOK_BASE_URL`).
- Gating por plan: componentes en `components/plan/` + `gating_events`.

**El gap:** el flujo actual termina en una `copilot_task` para que el staff envíe los mensajes a mano. Falta la cascada automática de ofertas, el manejo de respuestas, el llenado del slot y el contador.

---

## 2. Comportamiento objetivo (historia completa)

1. Una cita pasa a `cancelled` o `no_show` (o el cron de gap-detection abre un slot) → se crea/reusa un `slot_opening` con candidatos rankeados.
2. El agente inicia una **cascada secuencial de ofertas** por WhatsApp: oferta a candidato #1 → espera TTL → sin respuesta o rechazo → candidato #2 → … hasta `max_offers`.
3. La paciente responde "sí" (o variante) → se crea la cita (`appointments`), el slot pasa a `filled`, las ofertas pendientes restantes se cancelan con mensaje de cortesía, y `estimated_revenue_recovered` se incrementa con el precio del tratamiento.
4. Nadie acepta → el slot pasa a `escalated`: se crea `copilot_task` para el staff (comportamiento actual como fallback, no como default).
5. El dashboard muestra: **"S/ X recuperados este mes"** + lista de slots recuperados con detalle.

### Guardrails (obligatorios)
- **Horario silencioso:** no enviar ofertas fuera de 08:00–21:00 America/Lima; las que caigan fuera se programan para las 08:00 siguientes.
- **Anti-spam:** máx. 1 oferta activa por paciente a la vez (global por organización); máx. 3 ofertas de slots distintos a la misma paciente por semana.
- **Expiración del slot:** si `slot_start - now() < 2h`, no iniciar cascada nueva; escalar directo a staff.
- **Opt-out:** respuesta tipo "no me escriban" → `patients.custom_data.no_slot_offers = true` y excluir en `findCandidates()`.
- **Idempotencia:** única oferta `pending|sent` por `(slot_opening_id, patient_id)` (índice único parcial).

---

## 3. Migración de base de datos

Crear `supabase/migrations/<timestamp>_slot_offers.sql`:

```sql
-- ─── Slot offers: una fila por oferta enviada en la cascada ───
CREATE TABLE public.slot_offers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id         UUID        NOT NULL REFERENCES public.branches(id),
  slot_opening_id   UUID        NOT NULL REFERENCES public.slot_openings(id) ON DELETE CASCADE,
  patient_id        UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,

  rank_position     INT         NOT NULL,              -- posición en la cascada (1 = mejor score)
  score             INT         NOT NULL,
  wa_message        TEXT        NOT NULL,              -- mensaje enviado (auditoría)
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending',    -- creada, aún no enviada (respeta quiet hours)
                                  'sent',       -- enviada por n8n, esperando respuesta
                                  'accepted',   -- paciente confirmó → gana el slot
                                  'declined',   -- paciente rechazó
                                  'expired',    -- venció el TTL sin respuesta
                                  'cancelled'   -- otra paciente ganó el slot antes
                                )),
  sent_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,                       -- sent_at + TTL
  responded_at      TIMESTAMPTZ,
  patient_response  TEXT,                              -- respuesta cruda para auditoría/tuning

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo una oferta viva por slot+paciente
CREATE UNIQUE INDEX idx_slot_offers_active
  ON public.slot_offers (slot_opening_id, patient_id)
  WHERE status IN ('pending','sent');

-- Solo una oferta viva por paciente en toda la organización (anti-spam)
CREATE UNIQUE INDEX idx_slot_offers_patient_active
  ON public.slot_offers (organization_id, patient_id)
  WHERE status IN ('pending','sent');

CREATE INDEX idx_slot_offers_opening ON public.slot_offers (slot_opening_id, rank_position);
CREATE INDEX idx_slot_offers_expiry  ON public.slot_offers (status, expires_at) WHERE status = 'sent';

ALTER TABLE public.slot_offers ENABLE ROW LEVEL SECURITY;
-- Políticas: mismo patrón que slot_openings (org select / staff+ write). Sin acceso superadmin.

-- Ampliar slot_openings para el modo agente
ALTER TABLE public.slot_openings
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'agent'
    CHECK (mode IN ('agent','manual')),          -- manual = flujo viejo (task para staff)
  ADD COLUMN IF NOT EXISTS cascade_position INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovered_price NUMERIC(10,2);

-- status 'escalated' para cascada agotada
ALTER TABLE public.slot_openings DROP CONSTRAINT IF EXISTS slot_openings_status_check;
ALTER TABLE public.slot_openings ADD CONSTRAINT slot_openings_status_check
  CHECK (status IN ('open','offering','filled','expired','escalated'));
```

> `updated_at`: reutilizar el trigger `handle_updated_at()` existente.

---

## 4. Lógica de aplicación

### 4.1 Disparador en tiempo real (nuevo)
Hoy los slots nacen del cron diario. Agregar el disparo por evento:

- En el server action / ruta donde una cita cambia a `cancelled` o `no_show` (buscar el update de `appointments.status`; probablemente `app/(dashboard)/appointments/[id]/` y el flujo de rebooking): tras el update, llamar `openSlotFromAppointment(appointment)` en `lib/backfill/`.
- `openSlotFromAppointment`: crea `slot_opening` (reason = cancellation/no_show, `treatment_type`, `slot_start/end`, precio de la cita original en `recovered_price` como referencia) → llama `startCascade(slotOpeningId)`.
- Idempotencia: si ya existe un `slot_opening` `open|offering` para ese `appointment_id`, no duplicar.

### 4.2 `startCascade(slotOpeningId)` — nuevo en `lib/backfill/cascade.ts`
1. Cargar slot + validar guardrails (ventana de 2h, plan de la org — ver 4.6).
2. `findCandidates()` (existente) → filtrar: sin teléfono, `no_slot_offers`, con oferta activa en otra cascada.
3. Persistir top-N en `candidates` JSONB (ya existe) y crear la fila `slot_offers` del candidato #1 (`rank_position = 1`).
4. `sendOffer(offer)`: si estamos en quiet hours → dejar `pending` con `sent_at` programado; si no → POST al webhook n8n `slot-offer` con `{offerId, phone, message}`, marcar `sent`, `expires_at = now() + TTL`.
5. `slot_opening.status = 'offering'`, `cascade_position = 1`.

**TTL recomendado:** 25 min si `slot_start` es hoy; 90 min si es mañana o después. Config por org en `custom_data` futuro; hardcodear constantes por ahora en `lib/backfill/config.ts`.

### 4.3 Avance de cascada — cron nuevo `GET /api/internal/slot-cascade`
Cada 5 min (Vercel Cron o n8n Schedule). Auth: mismo patrón `CRON_SECRET` de `gap-detection/route.ts`.
1. Expirar ofertas `sent` con `expires_at < now()` → `expired`.
2. Para cada slot `offering` sin oferta viva: tomar siguiente candidato del JSONB → crear/enviar oferta (`cascade_position++`).
3. Sin candidatos restantes → `slot_opening.status = 'escalated'` + crear `copilot_task` (reusar el helper actual de `triggerBackfill`).
4. Enviar ofertas `pending` cuya hora programada ya llegó.

### 4.4 Manejo de respuestas — extender el pipeline del webhook entrante
En el procesador de `webhook_queue` (donde hoy se normaliza el intake con `lib/intake/normalize.ts`):
1. **Antes** de tratar el mensaje como intake nuevo: buscar oferta `sent` para ese teléfono en la org (match por `patients.phone`).
2. Si existe → clasificar la respuesta. Determinístico primero (`sí|si|ok|confirmo|de una|claro` / `no|no puedo|no gracias`); ambiguo → clasificación con Gemini (`gemini-2.5-flash`, mismo patrón de `lib/copilot/process.ts`): `{"intent": "accept" | "decline" | "other"}`.
3. `accept` → transacción:
   - Crear `appointment` (paciente, branch, `treatment_type`, `scheduled_at = slot_start`, `price = recovered_price`, status `confirmed`, `metadata.source = 'slot_recovery'`).
   - `slot_opening`: `filled`, `filled_at`, `selected_patient_id`, `new_appointment_id`.
   - Oferta → `accepted`; demás ofertas vivas → `cancelled` + mensaje de cortesía vía n8n ("el cupo ya fue tomado, te avisamos del próximo").
   - `metrics_daily.estimated_revenue_recovered += recovered_price` (upsert por `branch_id + date`).
   - Confirmación por WhatsApp a la ganadora (fecha, hora, tratamiento, dirección de la sede desde `branches`).
4. `decline` → oferta `declined`; el cron avanza la cascada (o avanzar inline para no esperar 5 min).
5. `other` → dejar la oferta viva y pasar el mensaje al intake normal (puede ser una consulta legítima).

### 4.5 Contrato n8n (2 workflows nuevos)
- **`slot-offer`** (webhook): recibe `{offerId, phone, message, branchWaNumber}` → envía WhatsApp → callback opcional `POST /api/webhooks/slot-offer-sent` con `{offerId, waMessageId}` para confirmar `sent_at` real.
- **`slot-courtesy`**: mensajes de "cupo tomado" y confirmación de cita. Reusar la infraestructura de envío de los workflows actuales de reminders.

### 4.6 Gating por plan
El Recuperador es feature premium (es EL argumento de upgrade). Reusar `components/plan/route-gate.tsx` y `gated-action-button.tsx`:
- Plan base: modo `manual` (flujo actual con task).
- Plan superior: modo `agent`. Registrar `gating_events` cuando una org base tiene un slot recuperable — ese evento alimenta el `upgrade-banner`: *"PacienteIA pudo recuperar S/ 480 esta semana. Actívalo."* (el gating como vendedor).

---

## 5. UI

### 5.1 Dashboard (`app/(dashboard)/dashboard/`)
Widget nuevo, arriba: **"S/ recuperados este mes"** — suma de `estimated_revenue_recovered` del mes + sparkline simple + link a detalle. Es el número-héroe del producto: tratarlo visualmente como tal.

### 5.2 Página de detalle (`app/(dashboard)/recovery/`)
Tabla de `slot_openings` recientes: fecha/hora del hueco, tratamiento, razón, timeline de la cascada (a quién se ofreció, en qué orden, qué respondió), resultado y monto. Estados con badges (reusar `components/ui/badge.tsx`). Esta página es la que el dueño enseña a su socio: hacerla legible para no-técnicos.

### 5.3 Ajustes (`app/(dashboard)/settings/`)
Sección mínima: toggle agente on/off, horario silencioso, máx. ofertas por cascada (default 5). Persistir en `clinic_profiles`/`organizations.custom_data`.

---

## 6. Criterios de aceptación

1. Cancelar una cita con paciente en waitlist compatible → oferta WhatsApp sale en <60 segundos (fuera de quiet hours).
2. Respuesta "sí" → cita creada + slot `filled` + contador del dashboard incrementado con el precio correcto + confirmación enviada, todo sin intervención humana.
3. Respuesta "no" o silencio hasta TTL → siguiente candidata recibe oferta; agotados los candidatos → `escalated` + `copilot_task`.
4. Dos cancelaciones simultáneas nunca ofertan a la misma paciente a la vez (índice único lo garantiza — probar con test de concurrencia).
5. Mensaje a las 22:30 no se envía; sale 08:00 del día siguiente.
6. Org en plan base: no envía ofertas; genera `gating_event` y muestra banner de upgrade con el monto no recuperado.
7. `npm run build` limpio; RLS verificado: usuario de org A no ve `slot_offers` de org B.

## 7. Fuera de alcance (v1)
- Ranking con LLM (el scoring determinístico actual es suficiente y auditable; iterar con data real).
- Ofertas simultáneas en paralelo con "gana el primero" (la secuencial evita dobles reservas sin lógica de carrera).
- Precios dinámicos / descuentos de última hora (v2 potente: "-10% si tomas el cupo de hoy").
- Multi-idioma.

## 8. Secuencia de implementación sugerida para Claude Code
1. Migración `slot_offers` + columnas nuevas (probar contra seed).
2. `lib/backfill/cascade.ts` + config, con tests unitarios del avance de cascada.
3. Disparador en cancelación/no-show.
4. Cron `/api/internal/slot-cascade`.
5. Rama de respuestas en el procesador del webhook (el paso más delicado: no romper el intake existente — feature flag `SLOT_RECOVERY_ENABLED`).
6. Workflows n8n.
7. UI (widget, página, settings) + gating.
8. Prueba end-to-end en la clínica seed con números de prueba de WhatsApp.
