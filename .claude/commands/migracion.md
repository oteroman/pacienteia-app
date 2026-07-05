---
description: Crea y aplica una migración Supabase de forma segura (patrón Node HTTPS, RLS, aditiva).
argument-hint: <qué cambia en el esquema>
---

Despacha el subagente `db-migrator` para: **$ARGUMENTS**

Requisitos:
1. Escribe el archivo en `supabase/migrations/<timestamp>_<slug>.sql` continuando la secuencia del último timestamp.
2. Aplica las reglas de migración segura: RLS habilitada + políticas `is_org_member` en tablas nuevas, backfill antes de `NOT NULL`, sin `upsert` que borre contadores.
3. Muéstrame el SQL y **espera mi confirmación explícita antes de aplicarlo a producción** (es la DB de todas las clínicas).
4. Al aplicar, usa el patrón Node HTTPS (no PowerShell) y reporta el status HTTP + respuesta.
5. Confirma que un usuario de org A no puede ver datos de org B.
