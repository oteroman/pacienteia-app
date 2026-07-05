# PacienteIA — Visión de Producto

> Leer primero, junto con `product_roadmap.md`. Fuente de verdad del "por qué" del producto.

## Qué es
PacienteIA es un **SaaS B2B para clínicas y consultorios en Lima, Perú** que automatiza la operación vía WhatsApp: captación de leads, confirmación de citas, recordatorios, bandeja unificada de mensajes, reactivación de pacientes y análisis operativo.

**No es un sistema clínico — es un gerente de operaciones con IA.**

## La Regla de Hierro (no negociable)
La IA **NUNCA** da diagnósticos, prescripciones ni consejos de salud. Solo gestiona operaciones: citas, mensajes, recordatorios, leads, cobros, reactivación. Cualquier feature que viole esto se rechaza. Ante la duda, se aplica de forma conservadora.

## A quién sirve
- **ICP primario:** clínicas y consultorios en Lima (estética, dental, psicología, medicina).
- **Cuña validada** (trabajo de campo): el **médico especialista independiente** que trabaja de 1–2 consultorios alquilados, sin staff administrativo, coordinando todo por WhatsApp desde el celular.

### Restricciones por especialidad
| Especialidad | Restricción |
|--------------|-------------|
| Estética | Sin consejo médico; solo operaciones |
| Odontología | Planes multi-sesión; tracking de sesiones |
| Psicología | NUNCA revelar ni almacenar expuesto el motivo de consulta |
| Medicina general | Sin diagnósticos; solo gestión operativa |

## Propuesta de valor
Recuperar el tiempo y el dinero que hoy se fuga en la operación manual:
- **No-shows** (30–40%) → recordatorios, confirmaciones y depósitos.
- **Huecos** de cancelaciones/ausencias → recuperación automática ("S/ recuperados").
- **Leads perdidos** por respuesta tardía → bandeja unificada + SLA.
- **Horas** de coordinación manual → automatización WhatsApp.

**Principio rector: tangibilizar el valor en la moneda del dueño** (S/ recuperados, no-shows evitados, horas ahorradas), no en features abstractos.

## Contexto de mercado (Perú)
- **WhatsApp-first**: el canal por defecto de pacientes y clínicas.
- **Yape / Plin**: rieles de pago dominantes (depósitos anti-no-show ya integrados).
- **SUNAT**: boleta/factura electrónica obligatoria — oportunidad de integración validada.
- **Informalidad**: el médico independiente no tiene sistemas caros tipo hospital.

## Qué NO es
- No es historia clínica electrónica ni sistema de diagnóstico.
- No es una landing SaaS genérica — es un **backoffice clínico premium** (ver `DESIGN.md`).
- No da consejo de salud bajo ninguna circunstancia.
