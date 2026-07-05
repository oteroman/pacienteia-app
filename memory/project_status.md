# PacienteIA — Estado del Proyecto

> El último estado, qué está hecho y el próximo paso. Actualizar tras cada feature (responsabilidad de `release-manager`).

**Última actualización:** 2026-07-05

## Estado general
Plataforma en producción (`https://app.pacienteia.com`, Vercel `illari-labs/pacienteia-app`). Casi todos los módulos entregados — ver tabla COMPLETADO en `CLAUDE.md` para el detalle exhaustivo. Rama actual de trabajo: `chore/consolidate-work-and-scrub-secrets`.

## Hecho en la sesión reciente (2026-07-04/05)
- **Auditoría de bugs completa (2026-07-05).** Revisión detallada de toda la solución → 10 hallazgos, TODOS corregidos y desplegados (commits `3df5e94` + `2b15459`, deploys `8ok96z12y` + `eh99vw6qw`). **El proyecto ahora type-checkea con 0 errores** (antes ~14 reales enmascarados por `ignoreBuildErrors: true`; varios eran bugs de runtime). Hallazgos:
  - 🔴 `sendWhatsAppText` con firma vieja (4 args posicionales) en 3 sitios → 3 features WhatsApp muertas silenciosamente (sala de espera "es tu turno", aviso de demora, alerta de marketing al dueño). Corregido a `{ branchId, to, body }`.
  - 🔴 `logAdSpend` con firma `(prev, formData)` de useActionState usada como form action directo → **crash** al registrar gasto publicitario. Cambiado a `(formData)`.
  - 🟠 Inyección de filtro PostgREST en API v1 `/patients` (`q` crudo en `.or()`) → sanitizado (strip `,()\`). No había fuga cross-tenant (org scope aparte).
  - 🔵 Contador de dinero recuperado: race del read-modify-write → **RPC atómico** `increment_recovered_revenue` (migración `20260705000002`, aplicada) con fallback.
  - 🔵 No-show blindado: default ON → **opt-in (default OFF)** vía `isAutomationEnabled(...,false)`. No cancela citas sin habilitación expresa por sucursal.
  - 🟡 Labels de plan `multi_branch` (billing/pricing), tipos `never` en consent, ruta fantasma `/analytics/admin` → corregidos.
  - ✅ Verificado SÓLIDO (sin cambios necesarios): aislamiento multi-tenant en todas las mutaciones, auth+gate+org en API v1, `/api/notifications` scopeado, check anti-IDOR en `org-selector/auto`, cero secretos hardcodeados en fuente.
  - 📋 Recomendado a futuro: regenerar `types/database.ts` (tiene `dni` faltante), revisar a fondo la resolución de tenant en el webhook entrante y la idempotencia de reply handlers.
- **Incidente prod login resuelto (2026-07-05).** `app.pacienteia.com` caía tras el login. TRES causas encadenadas, todas arregladas y verificadas en prod (usuario confirmó "todo ok"):
  1. `SUPABASE_SERVICE_ROLE_KEY` de Vercel inválida tras rotar la key en Supabase → PATCH env a la key actual + `vercel redeploy`.
  2. `/org-selector` escribía cookie durante el render (Next 15 lo prohíbe) → 500 al vencer la cookie de contexto. Commit `26b8adb`.
  3. Auto-forward de 1 org/1 sucursal restaurado vía Route Handler `/org-selector/auto` + cookie de contexto extendida de 30 días a 1 año. Commit `145ffc0`.
  - **Modelo de deploy: CLI (`vercel --prod`) desde un worktree limpio de `main`**, no git-connected. Prod era `main`@`e3dc405`; ahora `main`@`145ffc0`.
  - ✅ **DIVERGENCIA RESUELTA (2026-07-05):** los 2 fixes de login se cherry-pickearon a `chore/consolidate-work-and-scrub-secrets` (`dd58dc3`, `8feac4c`); ambas ramas pusheadas a origin. Migración `deposit_expiry` aplicada a prod.
  - **Lección:** al rotar una key en Supabase, actualizar Vercel + redeploy o el deploy vivo queda con la credencial vieja.
- **Regresión de nav + app completa restaurada (2026-07-05).** Al desplegar los fixes de login desde un worktree LIMPIO de `main` (`e3dc405`), se cayeron ~47 días de trabajo que solo vivían como código SIN commitear en local (nav completo con Horarios/Servicios/Profesionales/Staff/Sucursales/Pagos/etc. + módulos). **Causa raíz:** prod histórico se desplegaba desde el working tree local, NO desde `main` commiteado — por eso `main` pelado ≠ prod real. **Fix:** desplegada la rama `chore/consolidate-work-and-scrub-secrets` (`4fcb12f`, deploy `nbxd8fglb`) que tiene TODO commiteado + login fixes + migración aplicada. ⚠️ **NO desplegar `main` pelado — regresa la app.** Prod ahora = contenido de la rama de consolidación; `main` (`145ffc0`) está detrás. **Recomendado:** mergear consolidación→`main` (PR #1) para que `main` = prod y evitar el pie.
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
