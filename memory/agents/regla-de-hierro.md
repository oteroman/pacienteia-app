# Memoria de trabajo — regla-de-hierro

> Lee antes de empezar. Añade una entrada al tope del historial al terminar.

## Pendiente / próximo
- Auditar los prompts de Gemini de cualquier feature nuevo de mensajería automática (cascada de ofertas, respuestas sugeridas) para confirmar que jamás interpretan síntomas ni dan consejo clínico — solo operaciones.

## Historial

### 2026-07-05 — Gate "No-show blindado" — CUMPLE
- **Qué revisé:** mensaje de cortesía en `lib/backfill/deposit-expiry.ts` y la oferta de recuperación (`buildWaMessage`).
- **Veredicto:** operativo puro — informa liberación del cupo e invita a reagendar. Sin diagnóstico, prescripción ni consejo de salud. No expone datos clínicos (el tratamiento es la propia reserva del paciente).

### 2026-07-04 — Línea base
- **Qué:** Establecido el gate. Superficies de IA a vigilar: `lib/copilot/`, `lib/intake/`, `lib/voice/`, sales bot (Paxi), respuestas automáticas de WhatsApp.
- **Recordatorio permanente:** psicología = nunca revelar/almacenar expuesto el motivo de consulta. Las ideas estratégicas de esta sesión (no-show blindado, boleta SUNAT, cierre del lunes) son operativas/financieras — no cruzan la línea.
