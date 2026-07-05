# Memoria de trabajo — frontend-clinico

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- Página de detalle `/recovery` (o extender `/backfill`) con el timeline de la cascada de ofertas, cuando exista el SPEC. Debe ser legible para no-técnicos (el dueño se la enseña a su socio).

## Historial

### 2026-07-04 — Widget "número héroe" en el dashboard
- **Qué:** Widget "Recuperado por PacienteIA este mes" arriba del dashboard (suma mensual de `metrics_daily.estimated_revenue_recovered`). Solo aparece si el monto > 0. Estilo per DESIGN.md: superficie blanca, número en `lima-600`, badge "IA activa" en morado (#7C3AED/#F3EEFF), sin gradiente de fondo. Link a `/backfill`.
- **Archivos:** `app/(dashboard)/dashboard/page.tsx`
- **Resultado:** `tsc --noEmit` limpio. Sin commit ni deploy aún.
- **Próximo:** cuando la cascada esté activa, considerar sparkline y desglose por semana.
