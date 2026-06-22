# Analytics y Reportería

## ¿Qué hace?

El módulo de analytics muestra el desempeño operativo de la clínica en tiempo real. Incluye un dashboard principal con KPIs del funnel completo, y cuatro sub-dashboards especializados: recordatorios, reputación, reactivación e ingresos. Todos soportan filtro por período de tiempo.

## Dashboard Principal (`/analytics`)

### Selector de período
| Opción      | Ventana                               |
|-------------|---------------------------------------|
| 7 días      | Últimos 7 días hasta ahora            |
| 30 días     | Últimos 30 días hasta ahora (default) |
| Este mes    | Desde el 1 del mes actual             |

Cada período compara con el período anterior equivalente para calcular el delta (▲/▼).

### Sección 1: Funnel de operación

| Métrica           | Cálculo                                                      |
|-------------------|--------------------------------------------------------------|
| Leads recibidos   | Conteo de `intakes` creados en el período                   |
| Citas agendadas   | Conteo de `appointments` creados en el período              |
| Citas completadas | Conteo de `appointments` con status `completed` y `scheduled_at` en el período |
| Ingresos          | Suma del campo `price` de citas completadas con precio registrado (en soles S/) |

Todos muestran el delta porcentual vs el período anterior.

### Sección 2: Eficiencia operativa

| Métrica                | Cálculo                                                             | Semáforo            |
|------------------------|---------------------------------------------------------------------|---------------------|
| Fill rate              | `completadas / total_no_canceladas × 100`                          | Verde ≥60%, Amarillo ≥40%, Rojo <40% |
| Tasa de confirmación   | `r24_confirmados / r24_activos × 100` (recordatorios 24h)          | Verde ≥60%, Amarillo ≥30%, Rojo <30% |
| SLA leads              | Leads donde `first_response_at ≤ sla_due_at` / total con respuesta | Verde ≥70%, Amarillo ≥40%, Rojo <40% |
| NPS pacientes          | `(promotores - detractores) / total_respuestas × 100`              | Verde ≥50, Amarillo ≥0, Rojo <0 |

El NPS usa ratings de `appointment_followups`: promotores = rating 4-5, detractores = rating 1-2.

### Sección 3: Análisis detallado

Links a los 4 sub-dashboards especializados.

---

## Sub-dashboard: Recordatorios (`/analytics/reminders`)

Muestra el embudo completo de los recordatorios automáticos y su impacto en los no-shows.

### Métricas de recordatorios 24h

| Métrica           | Definición                                           |
|-------------------|------------------------------------------------------|
| Total enviados    | Recordatorios 24h enviados en el período             |
| Confirmados       | Status `confirmed` (respondieron "1")                |
| Reagendados       | Status `reschedule_requested` (respondieron "2")     |
| Sin respuesta     | Total - confirmados - reagendados - fallidos         |
| Tasa confirmación | `confirmados / (total - fallidos) × 100`             |

### Métricas de citas del período

| Métrica          | Definición                                           |
|------------------|------------------------------------------------------|
| Total citas      | Citas con `scheduled_at` en el período               |
| Completadas      | Status `completed`                                   |
| No-shows         | Status `no_show`                                     |
| Canceladas       | Status `cancelled`                                   |
| Tasa no-show     | `no_shows / total × 100`                             |

### Períodos disponibles: 7d, 30d, 90d

---

## Sub-dashboard: Reputación (`/analytics/reputation`)

### Métricas de encuestas post-cita

| Métrica           | Definición                                           |
|-------------------|------------------------------------------------------|
| Enviadas          | Total de follow-ups enviados en el período           |
| Respondidas       | Status `responded` con rating no nulo                |
| Tasa de respuesta | `respondidas / enviadas × 100`                       |
| Rating promedio   | Media aritmética de todos los ratings (escala 1-5)  |

### Distribución de ratings

Muestra conteo de respuestas para cada estrella (5, 4, 3, 2, 1).

### NPS

| Categoría    | Ratings |
|--------------|---------|
| Promotores   | 4 y 5  |
| Pasivos      | 3      |
| Detractores  | 1 y 2  |

**Fórmula:** `NPS = (promotores - detractores) / total_respondidos × 100`

### Escudo de reputación

| Métrica             | Definición                                          |
|---------------------|-----------------------------------------------------|
| Links Google enviados | `review_link_sent = true` (pacientes satisfechos) |
| Alertas creadas     | `alert_created = true` (pacientes insatisfechos)   |

### Tabla de alertas

Muestra hasta 20 alertas recientes (ratings 1-3) con: paciente, rating, fecha de cita, tratamiento.

---

## Sub-dashboard: Reactivación (`/analytics/reactivation`)

Muestra el embudo de la campaña de reactivación de pacientes inactivos.

Métricas visualizadas desde la tabla `reactivation_campaigns`:
- Mensajes paso 1 enviados
- Mensajes paso 2 enviados (sin respuesta al paso 1)
- Respuestas positivas recibidas
- Tasa de conversión (respondidos / total enviados)

---

## Sub-dashboard: Revenue (`/analytics/revenue`)

Muestra análisis de ingresos y fill rate histórico desde la tabla `appointments`.

Las métricas de revenue usan el campo `price` de las citas completadas. Los ingresos se muestran en soles peruanos (S/).

---

## Señales de Renovación (vista superadmin)

El módulo `lib/analytics/signals.ts` calcula una señal por clínica para el equipo de ventas/customer success de PacienteIA (no es visible para los dueños de clínica).

### Señales disponibles

| Señal                   | Descripción                                                    | Condición                                    |
|-------------------------|----------------------------------------------------------------|----------------------------------------------|
| `renewal_risk`          | Riesgo de churn — intervención urgente                        | Fill rate < 20% con slots abiertos, O SLA < 30% con intakes, O cancelaciones > 50% |
| `expansion_ready`       | Condiciones ideales para propuesta de upgrade                 | Fill ≥ 70%, SLA ≥ 70% y revenue recuperado activo |
| `expansion_low_hanging` | Buen desempeño, oportunidad de upgrade con CTA simple         | (Fill ≥ 50% o SLA ≥ 60%) y score ≥ 50      |
| `healthy_renewal`       | Operación estable, preparar renovación                        | Fill ≥ 40%, SLA ≥ 50% y score ≥ 40          |
| `renewal_watch`         | Adopción baja, check-in antes del próximo ciclo               | Todos los demás con actividad                |
| `inactive`              | Sin citas ni revenue en el período                            | 0 completadas y 0 revenue                   |

Cada señal incluye un playbook de acciones sugeridas para el CS de PacienteIA.

## Tablas de BD involucradas

| Tabla                    | Uso                                              |
|--------------------------|--------------------------------------------------|
| `intakes`                | Leads recibidos para el funnel                  |
| `appointments`           | Citas, revenue, fill rate, no-shows             |
| `appointment_reminders`  | Funnel de confirmaciones y estadísticas         |
| `appointment_followups`  | Encuestas, ratings, NPS, escudo de reputación   |
| `reactivation_campaigns` | Embudo de reactivación                          |

## Archivos clave

| Archivo                                             | Propósito                                          |
|-----------------------------------------------------|----------------------------------------------------|
| `app/(dashboard)/analytics/page.tsx`                | Dashboard principal con funnel y eficiencia        |
| `app/(dashboard)/analytics/reminders/page.tsx`      | Sub-dashboard de recordatorios                     |
| `app/(dashboard)/analytics/reputation/page.tsx`     | Sub-dashboard de reputación y NPS                  |
| `app/(dashboard)/analytics/reactivation/page.tsx`   | Sub-dashboard de reactivación                      |
| `app/(dashboard)/analytics/revenue/page.tsx`        | Sub-dashboard de revenue                           |
| `lib/analytics/reminders.ts`                        | `fetchReminderStats()` — lógica de métricas        |
| `lib/analytics/reputation.ts`                       | `fetchReputationStats()` — NPS y escudo           |
| `lib/analytics/signals.ts`                          | Señales de churn/renewal para superadmin           |
