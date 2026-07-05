# Memoria de trabajo — arquitecto-plan

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- **"No-show blindado" — plan listo, bloqueado en 3 decisiones de producto** antes de codear (gate del ciclo `/feature`): (1) ¿la cita se cancela o solo se ofrece el slot?, (2) ¿mensaje de cortesía al paciente?, (3) ventana fija 2h vs configurable. Reco: cancelar + cortesía + 2h fija v1.
- Resolver la **ambigüedad sync/async del §4.4 del SPEC** (handler de respuestas a ofertas): ¿webhook Next.js (<15s Meta) o consumidor de `webhook_queue` (n8n)?

## Historial

### 2026-07-05 — Plan "No-show blindado"
- **Qué:** Migración `20260705000001_deposit_expiry.sql` (col `appointments.payment_requested_at` + índice parcial). Capturar el timestamp en `lib/payments/index.ts`. Nuevo `lib/backfill/deposit-expiry.ts` (`releaseExpiredDeposits`) + cron `app/api/internal/deposit-expiry/route.ts` (auth `CRON_SECRET`, patrón gap-detection). Toggle via `isAutomationEnabled(...,'deposit_expiry')` — nueva key en `lib/automation/settings.ts`. Reusa `triggerBackfill({reason:'cancellation'})`.
- **Multi-tenant:** filtra org/branch; `triggerBackfill` ya aísla. **Migración segura:** aditiva (columna nullable + índice).
- **Próximo:** aprobación de las 3 decisiones → pasa a `db-migrator` + `backend-actions` + `integraciones`.

### 2026-07-04 — Revisión del SPEC "Recuperador de Huecos"
- **Qué:** Auditado `SPEC-recuperador-de-huecos.md` contra el código real. La arquitectura es sólida (extiende `lib/backfill/`). 3 correcciones a incorporar antes de construir:
  1. Migración: backfill `mode='manual'` en filas viejas antes del default `'agent'`.
  2. TTL same-day de 25 min es muy corto → subir a ~45 min.
  3. Índice anti-spam (1 oferta activa por paciente/org) puede bloquear ofertas legítimas de otro tratamiento — decisión de producto a validar.
- **Hallazgo clave:** el flujo actual NO termina solo en task manual; `triggerBackfill` ya envía WA a top-3 en paralelo. El gap real es cascada secuencial + `slot_offers` + handler de respuestas + contador.
- **Próximo:** definir sync/async del §4.4.
