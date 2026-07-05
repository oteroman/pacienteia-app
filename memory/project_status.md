# PacienteIA — Estado del Proyecto

> El último estado, qué está hecho y el próximo paso. Actualizar tras cada feature (responsabilidad de `release-manager`).

**Última actualización:** 2026-07-05

## Estado general
Plataforma en producción (`https://app.pacienteia.com`, Vercel `illari-labs/pacienteia-app`). Casi todos los módulos entregados — ver tabla COMPLETADO en `CLAUDE.md` para el detalle exhaustivo. Rama actual de trabajo: `chore/consolidate-work-and-scrub-secrets`.

## Hecho en la sesión reciente (2026-07-04/05)
- **Incidente prod login resuelto (2026-07-05).** `app.pacienteia.com` caía tras el login. TRES causas encadenadas, todas arregladas y verificadas en prod (usuario confirmó "todo ok"):
  1. `SUPABASE_SERVICE_ROLE_KEY` de Vercel inválida tras rotar la key en Supabase → PATCH env a la key actual + `vercel redeploy`.
  2. `/org-selector` escribía cookie durante el render (Next 15 lo prohíbe) → 500 al vencer la cookie de contexto. Commit `26b8adb`.
  3. Auto-forward de 1 org/1 sucursal restaurado vía Route Handler `/org-selector/auto` + cookie de contexto extendida de 30 días a 1 año. Commit `145ffc0`.
  - **Modelo de deploy: CLI (`vercel --prod`) desde un worktree limpio de `main`**, no git-connected. Prod era `main`@`e3dc405`; ahora `main`@`145ffc0`.
  - ⚠️ **DIVERGENCIA DE RAMAS:** `26b8adb` y `145ffc0` están en `main` (= prod) pero NO en `chore/consolidate-work-and-scrub-secrets` (donde vive recovery/no-show/SDLC). Si se despliega esa rama sin cherry-pickear estos 2 commits, se REGRESA el login. `main` local sin push — respaldar con `git push origin main`.
  - **Lección:** al rotar una key en Supabase, actualizar Vercel + redeploy o el deploy vivo queda con la credencial vieja.
- **Contador de dinero recuperado encendido.** `fillSlot` ahora escribe `metrics_daily.estimated_revenue_recovered` (idempotente, precio: cita original → catálogo `services`). `lib/backfill/index.ts`.
- **Widget "número héroe"** en el dashboard: "Recuperado por PacienteIA este mes". `app/(dashboard)/dashboard/page.tsx`.
- **Ecosistema SDLC Agéntico** creado: 9 subagentes (`.claude/agents/`), 4 comandos (`.claude/commands/`), playbook (`docs/sdlc-agentico.md`), memoria por agente (`memory/agents/`).
- **Carpeta `memory/` materializada** (no existía): vision, roadmap, status, credentials.
- Ambos cambios de código: `tsc --noEmit` limpio. **Sin commitear aún.**

## En vuelo / pendiente
| Prioridad | Ítem | Dónde |
|-----------|------|-------|
| 🔴 CRÍTICO | **Rotar credenciales** filtradas en historial git (service_role, n8n key, CRON_SECRET) | `memory/pending-credential-rotation.md` (auto-memory) |
| 🔴 | **PR #1 bloqueado** hasta rotar | `github.com/oteroman/pacienteia-app` |
| 🟡 | Migración `slot_offers` del SPEC (con fix `mode='manual'`) — no escrita | memoria `db-migrator` |
| 🟡 | Definir sync/async del handler de respuestas (§4.4 SPEC) | memoria `arquitecto-plan` |
| 🟡 | Workflows n8n `slot-offer` / `slot-courtesy` | memoria `integraciones` |

## Pendientes operativos (config, no código) — dueño: Manuel
- Google Review URL de La Rosa en Ajustes → WhatsApp.
- `retreatment_days` en servicios de La Rosa.
- `GOOGLE_OAUTH_CLIENT_ID/SECRET` + `FACEBOOK_APP_ID/SECRET/WEBHOOK_VERIFY_TOKEN` en Vercel.
- App Review Meta para Paxi (modo Live) + OAuth redirect URI + webhook Facebook.

## Próximo paso recomendado
**Idea Tier-1 "No-show blindado"** vía `/feature` — conecta el depósito Yape existente con la cascada de recuperación para que el número héroe recién encendido empiece a moverse solo. (Alternativa: construir la cascada completa del SPEC empezando por la migración, tras rotar credenciales.)
