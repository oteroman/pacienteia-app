# Memoria de trabajo — arquitecto-plan

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- Resolver la **ambigüedad sync/async del §4.4 del SPEC** (handler de respuestas a ofertas) antes de que `integraciones` lo implemente: ¿la intercepción va en el webhook Next.js (rápido, <15s Meta) o en el consumidor de `webhook_queue` (n8n)? Definirlo bloquea la implementación.

## Historial

### 2026-07-04 — Revisión del SPEC "Recuperador de Huecos"
- **Qué:** Auditado `SPEC-recuperador-de-huecos.md` contra el código real. La arquitectura es sólida (extiende `lib/backfill/`). 3 correcciones a incorporar antes de construir:
  1. Migración: backfill `mode='manual'` en filas viejas antes del default `'agent'`.
  2. TTL same-day de 25 min es muy corto → subir a ~45 min.
  3. Índice anti-spam (1 oferta activa por paciente/org) puede bloquear ofertas legítimas de otro tratamiento — decisión de producto a validar.
- **Hallazgo clave:** el flujo actual NO termina solo en task manual; `triggerBackfill` ya envía WA a top-3 en paralelo. El gap real es cascada secuencial + `slot_offers` + handler de respuestas + contador.
- **Próximo:** definir sync/async del §4.4.
