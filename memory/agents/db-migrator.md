# Memoria de trabajo — db-migrator

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- **Migración del SPEC "Recuperador de Huecos"** (`supabase/migrations/<ts>_slot_offers.sql`), aún no escrita ni aplicada. Debe incluir las correcciones detectadas por `arquitecto-plan`:
  - Tabla `slot_offers` con índices únicos parciales (anti-spam / idempotencia).
  - Ampliar `slot_openings`: columnas `mode`, `cascade_position`, `recovered_price` + status `offering`/`escalated`.
  - **Fix de seguridad:** backfillear `mode = 'manual'` en filas existentes ANTES de poner el default `'agent'` (si no, el cron dispararía cascada sobre slots viejos).
- Continuar la secuencia de timestamp desde el último: `20260518000001`.

## Historial

### 2026-07-05 — Migración deposit_expiry (escrita, NO aplicada)
- **Qué:** `supabase/migrations/20260705000001_deposit_expiry.sql` — `appointments.payment_requested_at timestamptz` + índice parcial `where payment_status='pending'`. Aditiva y segura (columna nullable, sin backfill destructivo).
- **Resultado:** archivo listo. **Pendiente de aplicar a producción con confirmación del usuario** (patrón Node HTTPS).
- **Próximo:** aplicar tras OK; luego desplegar el cron `/api/internal/deposit-expiry`.
