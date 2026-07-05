---
description: Prepara un cambio para producción — build, gates, disciplina de git y checklist de deploy.
argument-hint: [nota de release opcional]
---

Despacha el subagente `release-manager` para preparar el release${ARGUMENTS:+: $ARGUMENTS}.

Debe ejecutar la checklist en orden y **detenerse antes de commit/push/deploy para pedir mi aprobación explícita**:

1. `npx tsc --noEmit` + `npm run build` — reporta fielmente, distinguiendo errores nuevos de pre-existentes.
2. Confirma que los gates (`guardian-rls-seguridad`, `regla-de-hierro`) corrieron sin hallazgos abiertos; si no, pídelos primero.
3. `git diff --staged` sin secretos; archivos sensibles en `.gitignore`.
4. Si estoy en `main`, crea rama antes de commitear.
5. Espera mi OK para `commit` → `push` → `npx vercel --prod`.
6. Post-deploy: actualiza `memory/project_status.md` (y `CLAUDE.md` si es módulo nuevo).

Recuerda: nunca rotes env vars de Vercel por tu cuenta ni uses `--no-verify` sin que yo lo pida.
