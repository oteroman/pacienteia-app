# Memoria de trabajo — integraciones

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- **SPEC "Recuperador de Huecos"** (bloqueado por migración de `db-migrator` + decisión sync/async de `arquitecto-plan`):
  - 2 workflows n8n nuevos: `slot-offer` (envía oferta + callback `/api/webhooks/slot-offer-sent`) y `slot-courtesy` (mensajes "cupo tomado" + confirmación).
  - Handler de respuestas a ofertas en el pipeline del webhook entrante — **protegido con feature flag `SLOT_RECOVERY_ENABLED`**. Es el paso más delicado: no romper el intake existente (`lib/intake/normalize.ts`). Determinístico primero, Gemini solo para ambiguos.

## Historial

### 2026-07-05 — Captura de timestamp de separación + cortesía (No-show blindado)
- **Qué:** `sendPaymentRequest` ahora setea `payment_requested_at` al poner `payment_status='pending'` (flujos qr_image y niubiz) — habilita la expiración por ventana. El motor de liberación envía un WhatsApp de cortesía operativo al paciente cuyo cupo se liberó.
- **Archivos:** `lib/payments/index.ts`
- **Resultado:** `tsc` limpio. Regla de Hierro OK (mensaje operativo).
- **Pendiente:** 2 workflows n8n del SPEC (slot-offer/slot-courtesy) siguen sin construir.
