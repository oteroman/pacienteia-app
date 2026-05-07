# PacienteIA Release Checklist

## 0. Usuarios de prueba

| Plan | Email | Clave | Estado esperado |
|------|-------|-------|-----------------|
| Básico | `basico@test.pacienteia.com` | `Test1234!` | Hard blocked — 50/50 leads, 150/150 citas |
| Pro | `pro@test.pacienteia.com` | `Test1234!` | Soft blocked — 170/200 leads, 420/500 citas |
| Premium | `premium@test.pacienteia.com` | `Test1234!` | Sin bloqueos — 50/1000 leads, 200 citas |

---

## 1. Pre-release

- Verificar variables de entorno.
- Confirmar migraciones aplicadas.
- Validar que `ADMIN_DASHBOARD_SECRET` existe.
- Ejecutar build y typecheck.
- Revisar health check básico.

```bash
npm run build
npx tsc --noEmit
npm run lint
```

Migraciones esperadas (todas deben aparecer en Local y Remote):

```
20260505000001  initial schema
20260505000002  soft deletes
20260505000003  patient photo storage
20260507000001  subscriptions + usage
20260507000002  reactivation + feedback
20260507000003  gating_events
```

```bash
SUPABASE_ACCESS_TOKEN="<PAT>" npx supabase migration list --linked
```

---

## 2. Seguridad y Auth

- Confirmar login correcto.
- Verificar sesión persistente.
- Revisar rutas protegidas.
- Validar que usuarios no autorizados no acceden.
- Confirmar que `service_role` no llega al frontend.
- Revisar que el admin dashboard solo se use internamente.

```bash
# service_role debe aparecer solo en lib/supabase/admin.ts y analytics/admin/page.tsx
grep -r "createAdminClient\|supabase/admin" --include="*.ts" --include="*.tsx" app/ components/ lib/
```

---

## 3. Multi-tenant

- Básico solo ve su clínica.
- Pro solo ve su clínica.
- Premium solo ve su clínica.
- Confirmar que no hay cross-tenant leak.
- Verificar que queries y Server Actions filtran por `clinic_id`.
- Confirmar que analytics respeta el tenant actual.

---

## 4. Gating

### Básico
- Crear lead bloqueado.
- Crear cita bloqueada.
- Crear paciente bloqueado.

### Pro
- Confirmar soft block en límites.
- Verificar que aparece modal de upgrade.
- Confirmar que editar sigue la regla definida.

### Premium
- Verificar acceso completo.
- Confirmar que no aparece modal en acciones permitidas.

### Tracking

- `blocked_action_attempted`
- `modal_opened`
- `modal_closed`
- `cta_primary_clicked`
- `cta_secondary_clicked`

---

## 5. Admin dashboard

**URL:** `/analytics/admin?key=<ADMIN_DASHBOARD_SECRET>`

- Summary cards cargan.
- Bloqueos por recurso cargan.
- Top fricción por páginas y cuentas cargan.
- Candidatos a upgrade cargan.
- Alertas 80% y 100% funcionan.
- Últimos eventos se muestran bien.

---

## 6. Flujos críticos

- Leads: alta, bloqueo, modal, tracking.
- Pacientes: alta y bloqueo según plan.
- Citas: creación, bloqueo y edición.
- Billing: navegación desde modal y dashboard.

---

## 7. QA por usuario

| Usuario | Qué probar | Comportamiento esperado | Error crítico si... |
|---------|------------|------------------------|---------------------|
| `basico@test.pacienteia.com` | Leads, citas, pacientes, modal, dashboard | Hard block en creación; lectura permitida | Puede crear fuera de su plan o ve datos de otra clínica |
| `pro@test.pacienteia.com` | Leads, citas, modal upgrade, analytics | Soft block donde corresponde; CTA visible | No aparece el modal o el límite no se respeta |
| `premium@test.pacienteia.com` | Todas las acciones principales | Acceso completo sin bloqueos | Se bloquea una acción permitida |

---

## 8. Rollback

1. Revertir la última migración problemática.
2. Revertir env vars recientes en Vercel.
3. Deployar la versión anterior.
4. Validar login, dashboard y gating básico.
5. Confirmar que el admin dashboard sigue accesible solo internamente.

---

## 9. Seguridad conocida

- `ADMIN_DASHBOARD_SECRET` en query param es una deuda técnica temporal.
- `service_role` debe mantenerse solo server-side.
- Toda lectura multi-tenant debe filtrar por `clinic_id`.
- El admin dashboard no debe exponerse públicamente sin capa adicional de auth.

---

## 10. Firma de release

- [ ] Build OK
- [ ] Typecheck OK
- [ ] Lint OK
- [ ] Migraciones OK
- [ ] QA básico / pro / premium OK
- [ ] Rollback verificado
- [ ] Release aprobado
