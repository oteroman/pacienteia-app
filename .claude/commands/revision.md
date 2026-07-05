---
description: Corre los gates de calidad (seguridad/multi-tenant + Regla de Hierro) sobre los cambios actuales.
argument-hint: [ruta o alcance opcional]
allowed-tools: Bash(git diff:*), Bash(git status:*)
---

Corre los gates de calidad sobre los cambios actuales${ARGUMENTS:+ (alcance: $ARGUMENTS)}.

Primero muestra el alcance real (`git status`, `git diff --stat`). Luego despacha **en paralelo**:

- `guardian-rls-seguridad` — aislamiento por org/branch, uso correcto de admin client vs RLS, y fugas de secretos en el diff.
- `regla-de-hierro` — que ningún feature de IA cruce a consejo médico/diagnóstico; privacidad en psicología.

Consolida los hallazgos en una sola lista priorizada por severidad (CRÍTICO → ALTO → MEDIO), con `archivo:línea` y escenario de falla. Si ambos gates pasan limpios, dilo explícitamente. No propongas arreglos que no correspondan a un hallazgo real y verificado.
