# Memoria de trabajo — backend-actions

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- Cuando se construya la cascada del "Recuperador de Huecos" (SPEC), el handler de `accept` debe escribir `estimated_revenue_recovered` igual que ya lo hace el flujo manual (reutilizar `recordRecoveredRevenue` / la lógica de `fillSlot`).

## Historial

### 2026-07-04 — Encender el contador de dinero recuperado
- **Qué:** `fillSlot` ahora contabiliza el dinero recuperado en `metrics_daily.estimated_revenue_recovered` al llenar un hueco. Precio resuelto: cita original → catálogo `services` → 0 si no hay precio confiable. Idempotente (solo cuenta al transicionar a `filled`). Read-modify-write, no upsert (para no borrar otros contadores de la fila).
- **Archivos:** `lib/backfill/index.ts` (`fillSlot`, `resolveRecoveredPrice`, `recordRecoveredRevenue`)
- **Resultado:** `tsc --noEmit` limpio. Sin commit ni deploy aún.
- **Próximo:** el número héroe ya aparece en el dashboard; el paso mayor es la cascada autónoma (ver `db-migrator` / `integraciones`).
