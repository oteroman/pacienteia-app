# SDLC Agéntico — PacienteIA

> Ciclo de vida de desarrollo de software operado por agentes. El hilo principal de Claude Code actúa como **orquestador (tech lead)** y delega cada fase a subagentes especializados que codifican las reglas reales de este repo.

## Modelo de orquestación

```
                        ┌──────────────────────────┐
   Usuario  ───────────▶│   ORQUESTADOR (tech lead)│  ← hilo principal + CLAUDE.md
                        └──────────┬───────────────┘
                                   │ delega por fase (Agent tool)
   ┌───────────────┬───────────────┼────────────────┬─────────────────┐
   ▼               ▼               ▼                ▼                 ▼
Descubrir      Planear        Implementar         Calidad           Release
analista-    arquitecto-   backend-actions      guardian-rls-    release-
producto      plan          db-migrator          seguridad        manager
                            integraciones        regla-de-hierro
                            frontend-clinico
```

El orquestador revisa la salida de cada agente antes de avanzar, ejecuta en paralelo lo independiente, y **se detiene en los puntos de confirmación** (aplicar migración, commit, push, deploy).

## Fases → agentes

| Fase | Agente | Escribe código | Gate |
|------|--------|:---:|:---:|
| Descubrimiento / requisitos | `analista-producto` | solo docs | — |
| Arquitectura / plan | `arquitecto-plan` | no (solo lectura) | — |
| Implementación · datos | `db-migrator` | sí | — |
| Implementación · backend | `backend-actions` | sí | — |
| Implementación · integraciones | `integraciones` | sí | — |
| Implementación · UI | `frontend-clinico` | sí | — |
| Calidad · seguridad/tenant | `guardian-rls-seguridad` | no | ✅ obligatorio |
| Calidad · producto | `regla-de-hierro` | no | ✅ obligatorio |
| Release | `release-manager` | config/status | — |

## Comandos (flujos orquestados)

| Comando | Qué hace |
|---------|----------|
| `/feature <idea>` | SDLC completo: descubrimiento → arquitectura → implementación → gates → release |
| `/migracion <cambio>` | Crea y (con confirmación) aplica una migración segura |
| `/revision [alcance]` | Corre los dos gates de calidad sobre el diff actual |
| `/release [nota]` | Build + checklist de deploy (commit/push/deploy con aprobación) |

## Invariantes que todos los agentes respetan

1. **Regla de Hierro:** la IA nunca da diagnósticos, prescripciones ni consejos de salud. Solo operaciones.
2. **Multi-tenant:** todo dato se aísla por `organization_id` (+ `branch_id`). RLS con `is_org_member`. Admin client solo en Server Actions/webhooks.
3. **Seguridad:** cero secretos hardcodeados. Archivos sensibles en `.gitignore`. (Ver `memory/pending-credential-rotation.md`.)
4. **Git como fuente de verdad:** nada de desplegar saltándose git. Commit/push/deploy requieren OK del usuario.
5. **Verificación honesta:** `tsc`/build reportados fielmente; "hecho" solo cuando está verificado.

## Qué NO se delega (decisión del orquestador + usuario)

- Decisiones de arquitectura que afecten RLS o multi-tenancy.
- Aplicar migraciones a producción.
- Commits, push y deploys.
- Cambios en variables de entorno de Vercel.

## Memoria persistente por agente

Cada subagente tiene su propio registro en `memory/agents/<agente>.md` (convención en `memory/agents/README.md`). Sobrevive entre sesiones: el agente **lee su memoria antes de trabajar** y **registra lo que construye al terminar**.

- **Implementadores** (`db-migrator`, `backend-actions`, `frontend-clinico`, `integraciones`, `analista-producto`, `release-manager`): se auto-registran (tienen permiso de escritura).
- **Gates de solo-lectura** (`arquitecto-plan`, `guardian-rls-seguridad`, `regla-de-hierro`): emiten su entrada de memoria al final del reporte y **el orquestador la persiste** — no escriben archivos ellos mismos, para no contradecir su rol de solo-lectura.

Cada entrada: fecha · qué · archivos · resultado · próximo. Historial en orden cronológico inverso.

## Cómo extender el ecosistema

- **Nuevo especialista:** agrega `.claude/agents/<nombre>.md` con frontmatter `name` / `description` / `tools` (restringe a solo-lectura los que sean gates). La `description` es lo que el orquestador usa para enrutar — hazla precisa ("úsalo cuando…").
- **Nuevo flujo:** agrega `.claude/commands/<nombre>.md`. Usa `$ARGUMENTS` / `argument-hint`.
- Mantén cada agente enfocado en una responsabilidad y anclado a los patrones reales del repo (mapa de archivos en `CLAUDE.md`).
