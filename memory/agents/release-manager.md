# Memoria de trabajo — release-manager

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- 🔴 **Migración `20260705000001_deposit_expiry` SIN aplicar** — no hay PAT de Management en el entorno ni CLI instalada (la limpieza de secretos funcionó). Debe aplicarla el dueño (SQL Editor del dashboard) o proveer `SUPABASE_PAT`. **NO desplegar la feature no-show-blindado hasta aplicarla** (`sendPaymentRequest` escribe `payment_requested_at`).
- **PR #1 bloqueado** hasta rotar credenciales del historial (ver `guardian-rls-seguridad`).
- Pendiente agendar el cron `/api/internal/deposit-expiry` (n8n o Vercel Cron) cada 15-30 min, tras aplicar migración + desplegar.
- Todo local, sin push.

## Historial

### 2026-07-05 — Consolidación a git (3 commits, sin push)
- `282d1e3` feat(recovery): contador dinero recuperado + widget.
- `6727b9d` chore(sdlc): ecosistema agéntico + `memory/` base.
- `42039e8` feat(no-show-blindado): liberar cupos con separación vencida.
- `trabajo final/` y `memory/supabase_credentials.md` excluidos por `.gitignore`. Escaneo de secretos limpio.
- **No se pudo aplicar la migración** (sin PAT/CLI) — queda para el dueño.
