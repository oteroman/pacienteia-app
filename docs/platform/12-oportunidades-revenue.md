# 12 — Oportunidades de Revenue (Ciclo de Retratamiento)

Detección automática de pacientes cuyo ciclo de retratamiento está por vencer pero aún no tienen cita agendada.

---

## Concepto

Muchos tratamientos tienen una cadencia predecible: un paciente que recibió botox hace 4 meses necesita otra sesión. Si el sistema conoce el ciclo de retratamiento de cada servicio, puede detectar automáticamente quién está "por vencer" y mostrárselo al staff como oportunidad de agenda.

**Impacto:** convierte retratamientos en revenue activo en lugar de esperar que el paciente recuerde llamar.

---

## Configuración de Servicios

### Campo nuevo: `retreatment_days`

Columna `INTEGER` opcional en la tabla `services`. Representa cuántos días después de completar el servicio el paciente debería volver.

```sql
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS retreatment_days INT
  CHECK (retreatment_days IS NULL OR retreatment_days > 0);
```

**Migración:** `supabase/migrations/20260512000008_service_retreatment_days.sql`

### UI

En `app/(dashboard)/settings/services/page.tsx`:
- El formulario de crear servicio tiene un campo "Ciclo (días)" (opcional)
- Los servicios con ciclo configurado muestran un badge verde "Ciclo: Xd" en la lista

En `app/actions/services.ts`:
- `createService()` lee `retreatment_days` del FormData y lo guarda

---

## Algoritmo de Detección

Archivo: `lib/analytics/opportunities.ts`

### Función principal

```typescript
fetchRevenueOpportunities(organizationId: string, lookaheadDays = 14): Promise<RevenueOpportunity[]>
```

### Pasos del algoritmo

1. **Obtener servicios activos** con `retreatment_days IS NOT NULL`
2. **Obtener últimas citas completadas** para esos tipos de tratamiento en el último año (una por combinación paciente+tratamiento, la más reciente)
3. **Excluir pacientes con cita futura** para ese mismo tratamiento (ya están agendados)
4. **Calcular `dueDate`** = `lastAptAt + retreatment_days`
5. **Incluir si** `daysUntilDue` está entre −30 y +14 (hasta 30 días vencido o hasta 14 días en el futuro)
6. **Clasificar urgencia:**
   - `overdue`: vencido (daysUntilDue < 0)
   - `this_week`: vence en los próximos 7 días
   - `upcoming`: vence en 8–14 días
7. **Ordenar** por `daysUntilDue` ascendente (vencidos primero)

### Tipo de resultado

```typescript
interface RevenueOpportunity {
  patientId:    string
  patientName:  string
  phone:        string | null
  treatmentType: string
  lastAptAt:    string        // ISO timestamp
  dueDate:      string        // ISO timestamp
  daysUntilDue: number        // negativo = vencido
  urgency:      'overdue' | 'this_week' | 'upcoming'
}
```

---

## UI

### Página `/opportunities`

Archivo: `app/(dashboard)/opportunities/page.tsx`

- Agrupa por urgencia: **Vencidos** (rojo) → **Esta semana** (ámbar) → **Próximos 14 días** (verde)
- Cada `OpportunityCard` muestra:
  - Nombre del paciente (link a `/patients/[id]`)
  - Tipo de tratamiento + última cita + días para vencer
  - Botón "Agendar ahora →" que va a `/appointments/new?patient_id=X&treatment_type=Y`
- Estado vacío guía al usuario a configurar `retreatment_days` en sus servicios

### Widget en Dashboard

En `app/(dashboard)/dashboard/page.tsx`:
- Pill de alerta verde: "X oportunidades de agenda esta semana" → `/opportunities`
- Widget lateral "Oportunidades de agenda": muestra las 4 más urgentes con label de urgencia
- Link directo a crear cita con parámetros pre-cargados

---

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `supabase/migrations/20260512000008_service_retreatment_days.sql` | Agrega columna `retreatment_days` a `services` |
| `lib/analytics/opportunities.ts` | `fetchRevenueOpportunities()` |
| `app/(dashboard)/opportunities/page.tsx` | Página de lista de oportunidades |
| `app/(dashboard)/settings/services/page.tsx` | Formulario con campo "Ciclo (días)" |
| `app/actions/services.ts` | `createService()` — persiste `retreatment_days` |
| `app/(dashboard)/dashboard/page.tsx` | Widget y pill de alertas |

---

## Métricas para Evaluar el Feature

- **Oportunidades generadas por semana** (cuántas detecta el sistema)
- **Tasa de conversión** (oportunidades → cita agendada desde el botón "Agendar ahora")
- **Revenue atribuible** (citas creadas desde `/appointments/new?...` con origin `opportunity`)

---

## Notas para Desarrolladores

- El algoritmo no tiene estado propio — lee `appointments` en tiempo real. No hay tabla nueva.
- `lookaheadDays` es configurable (default 14). Se puede exponer como filtro en la UI si el cliente lo necesita.
- Para psicología: la detección funciona igual, pero el nombre del `treatment_type` no debe mostrarse en el mensaje WhatsApp (regla de privacidad). La página de oportunidades es solo para staff interno.
