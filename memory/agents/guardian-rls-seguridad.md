# Memoria de trabajo — guardian-rls-seguridad

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- **Rotación de credenciales pendiente (CRÍTICO):** secretos siguen en el historial de git ya pusheado (`github.com/oteroman/pacienteia-app`): Supabase `service_role`, n8n API key, `CRON_SECRET`. Ver `memory/pending-credential-rotation.md` (auto-memory). Scrubbear el working tree NO neutraliza el historial — hay que rotar en Supabase/n8n/Vercel. No introducir nuevas exposiciones mientras tanto.
- Al revisar la futura tabla `slot_offers`: confirmar `ENABLE ROW LEVEL SECURITY` + políticas `is_org_member`, y que org A no vea ofertas de org B.

## Historial

### 2026-07-05 — Gate "No-show blindado" — LIMPIO
- **Qué audité:** `lib/backfill/deposit-expiry.ts` + cron `deposit-expiry`.
- **Hallazgos:** ninguno. `releaseExpiredDepositsForOrg` filtra `.eq('organization_id')` en select y update; `triggerBackfill` recibe org/branch explícitos; `isAutomationEnabled` filtra org+branch; cron con auth `CRON_SECRET`; sin secretos hardcodeados. Admin client apropiado (contexto cron).
- **Próximo:** re-verificar RLS de `slot_offers` cuando exista.
