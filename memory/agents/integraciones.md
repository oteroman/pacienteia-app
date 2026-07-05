# Memoria de trabajo — integraciones

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- **SPEC "Recuperador de Huecos"** (bloqueado por migración de `db-migrator` + decisión sync/async de `arquitecto-plan`):
  - 2 workflows n8n nuevos: `slot-offer` (envía oferta + callback `/api/webhooks/slot-offer-sent`) y `slot-courtesy` (mensajes "cupo tomado" + confirmación).
  - Handler de respuestas a ofertas en el pipeline del webhook entrante — **protegido con feature flag `SLOT_RECOVERY_ENABLED`**. Es el paso más delicado: no romper el intake existente (`lib/intake/normalize.ts`). Determinístico primero, Gemini solo para ambiguos.

## Historial
_(sin cambios de integración por este agente aún)_
