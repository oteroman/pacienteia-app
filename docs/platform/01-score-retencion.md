# Score de Retención por Paciente

## ¿Qué hace?

Calcula un puntaje de 0 a 100 para cada paciente que indica qué tan probable es que vuelva a la clínica. Un score bajo predice churn con semanas de anticipación, permitiendo intervenir antes de perder al paciente.

## Cómo funciona

1. Cuando el staff abre la ficha de un paciente (`/patients/[id]`), el sistema carga su historial de citas.
2. Se calcula el score en tiempo real a partir de los datos históricos (no requiere CRON).
3. El score se muestra como una barra de progreso con etiqueta y color codificado.

## Lógica de cálculo / Algoritmo

El score parte de 100 y aplica penalizaciones y bonificaciones:

**Penalizaciones por inactividad (recency):**
| Días desde última cita | Penalización |
|------------------------|-------------|
| > 120 días             | -45 puntos  |
| > 90 días              | -30 puntos  |
| > 60 días              | -20 puntos  |
| > 30 días              | -10 puntos  |

**Bonificación por compromiso activo:**
| Condición                      | Bonus    |
|--------------------------------|----------|
| Tiene una cita futura agendada | +15 puntos |

**Penalizaciones por no-shows (tasa de inasistencia):**
| Tasa de no-shows (sobre total de citas) | Penalización |
|-----------------------------------------|-------------|
| > 50%                                   | -35 puntos  |
| > 25%                                   | -20 puntos  |
| > 10%                                   | -10 puntos  |
| > 0%                                    | -5 puntos   |

**Penalización adicional:**
| Condición                          | Penalización |
|------------------------------------|-------------|
| La última cita fue un no-show      | -10 puntos  |

**Bonificación por lealtad (profundidad de historial):**
| Total de citas pasadas | Bonus    |
|------------------------|----------|
| >= 6 citas             | +10 puntos |
| >= 3 citas             | +5 puntos  |

El resultado se sujeta al rango [0, 100].

**Etiquetas por puntaje:**
| Rango    | Etiqueta    | Color       |
|----------|-------------|-------------|
| 80 - 100 | Fiel        | Verde       |
| 60 - 79  | Estable     | Azul cielo  |
| 40 - 59  | En riesgo   | Ámbar       |
| 0 - 39   | Riesgo alto | Rojo        |

Si el paciente no tiene historial de citas: score = 0, etiqueta "Sin historial".

## Configuración

No requiere configuración. El score se calcula automáticamente al cargar la ficha del paciente.

## Tablas de BD involucradas

| Tabla          | Uso                                         |
|----------------|---------------------------------------------|
| `patients`     | Datos del paciente, `last_visit_date`       |
| `appointments` | Historial de citas: `status`, `scheduled_at` |

## Archivos clave

| Archivo                                            | Propósito                              |
|----------------------------------------------------|----------------------------------------|
| `lib/analytics/retention.ts`                       | Algoritmo de score (`calculateRetentionScore`, `buildRetentionStats`) |
| `app/(dashboard)/patients/[id]/page.tsx`           | UI que muestra el score en la ficha del paciente |
