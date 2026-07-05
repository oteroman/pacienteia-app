---
description: Orquesta el SDLC completo de un feature nuevo — descubrimiento → arquitectura → implementación → gates → release.
argument-hint: <descripción del feature>
---

Vas a orquestar el ciclo de vida completo para: **$ARGUMENTS**

Actúa como tech lead. Delega cada fase al subagente especializado, revisa su salida antes de avanzar, y detente en los puntos de confirmación. No saltes fases.

## Flujo

1. **Descubrimiento** — despacha `analista-producto` con la idea. Obtén brief + historias de usuario con criterios de aceptación. Valida la Regla de Hierro. Si el alcance es ambiguo y bloquea, pregunta al usuario antes de seguir.

2. **Arquitectura** — despacha `arquitecto-plan` con el brief. Obtén el plan técnico: archivos, migración sí/no, impacto multi-tenant, plan de verificación. Presenta el plan al usuario para OK antes de escribir código.

3. **Implementación** — según el plan, despacha en el orden correcto:
   - `db-migrator` si hay migración (escribe primero; aplica solo con confirmación).
   - `backend-actions` para Server Actions / lib.
   - `integraciones` para WhatsApp / n8n / Gemini / pagos.
   - `frontend-clinico` para UI (lee DESIGN.md).
   Ejecuta en secuencia cuando haya dependencias; en paralelo cuando sean independientes.

4. **Gates de calidad** (obligatorios, solo lectura) — despacha en paralelo:
   - `guardian-rls-seguridad` (aislamiento tenant + secretos).
   - `regla-de-hierro` (sin consejo médico).
   Si hay hallazgos, vuelve a la fase de implementación para corregir. No avances con gates abiertos.

5. **Release** — despacha `release-manager`: build, type-check, checklist. **Commit/push/deploy solo con aprobación explícita del usuario.**

Al final, resume: qué se construyó, qué se verificó, qué queda pendiente (config operativa, migración por aplicar, etc.).
