# SDLC Agéntico — registro del proyecto

Ecosistema de desarrollo agéntico propio de PacienteIA, creado el 2026-07-04.

- **Definiciones de subagentes:** `.claude/agents/*.md` (9 especialistas por fase del SDLC).
- **Comandos orquestados:** `.claude/commands/*.md` (`/feature`, `/migracion`, `/revision`, `/release`).
- **Playbook completo:** `docs/sdlc-agentico.md` (modelo de orquestación, tabla fases→agentes, invariantes).
- **Memoria por agente:** `memory/agents/<agente>.md` — cada subagente lee su archivo antes de trabajar y registra lo que construye. Ver `memory/agents/README.md`.

## Roster
| Fase | Subagente |
|------|-----------|
| Descubrimiento | `analista-producto` |
| Arquitectura | `arquitecto-plan` |
| Datos | `db-migrator` |
| Backend | `backend-actions` |
| Integraciones | `integraciones` |
| UI | `frontend-clinico` |
| Gate seguridad/tenant | `guardian-rls-seguridad` |
| Gate Regla de Hierro | `regla-de-hierro` |
| Release | `release-manager` |

## Archivos base del proyecto (materializados 2026-07-05)
La carpeta `memory/` no existía pese a estar referenciada en `CLAUDE.md`. Ahora está completa:
- `memory/product_vision.md` — el "por qué" (visión, Regla de Hierro, ICP, mercado Perú).
- `memory/product_roadmap.md` — el "hacia dónde" (foco actual, Tier 1/2, moat).
- `memory/project_status.md` — el "último estado y próximo paso".
- `memory/supabase_credentials.md` — identificadores no-secretos + mapeo de secretos. **Gitignoreado; sin secretos en claro.**
