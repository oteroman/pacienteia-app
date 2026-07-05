# Memoria de trabajo — db-migrator

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- **Migración del SPEC "Recuperador de Huecos"** (`supabase/migrations/<ts>_slot_offers.sql`), aún no escrita ni aplicada. Debe incluir las correcciones detectadas por `arquitecto-plan`:
  - Tabla `slot_offers` con índices únicos parciales (anti-spam / idempotencia).
  - Ampliar `slot_openings`: columnas `mode`, `cascade_position`, `recovered_price` + status `offering`/`escalated`.
  - **Fix de seguridad:** backfillear `mode = 'manual'` en filas existentes ANTES de poner el default `'agent'` (si no, el cron dispararía cascada sobre slots viejos).
- Continuar la secuencia de timestamp desde el último: `20260518000001`.

## Historial
_(sin migraciones aplicadas por este agente aún)_
