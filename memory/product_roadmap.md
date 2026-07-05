# PacienteIA — Roadmap de Producto

> Leer junto con `product_vision.md`. El "hacia dónde". Estado detallado de lo entregado: `project_status.md` y la tabla COMPLETADO de `CLAUDE.md`.

## Principios de priorización
1. **Construir SOBRE lo existente** — la plataforma ya es enorme; conectar módulos antes que inventar.
2. **Tangible en <30 días** para el dueño de la clínica limeña.
3. **Sobre los rieles de Perú**: WhatsApp, Yape/Plin, SUNAT.
4. **Regla de Hierro** en cada feature.

## Entregado (resumen)
Base multi-tenant, inbox WhatsApp, recordatorios, post-cita + reputación, reactivación, analytics (funnel/eficiencia/growth/marketing), profesionales/horarios/servicios, leads pipeline, staff, backfill de slots, oportunidades de revenue, NLU, auto-agendamiento WA, Google Business, vendedor IA (Paxi), redes sociales, API pública + keys, pagos (Yape QR + Niubiz), rebooking, sala de espera, consolas de plataforma. *(Detalle completo en CLAUDE.md.)*

## Foco actual
**Recuperador de Huecos (agente activo de backfill)** — convertir cancelaciones/no-shows en citas recuperadas de forma autónoma, con el contador **"S/ recuperado por PacienteIA este mes"** como número héroe que justifica la suscripción en los primeros 14 días.
- SPEC: `SPEC-recuperador-de-huecos.md`.
- **Ya hecho:** el contador dejó de estar muerto — `fillSlot` escribe `metrics_daily.estimated_revenue_recovered` y el dashboard muestra el número.
- **Pendiente:** cascada secuencial de ofertas (`slot_offers`), handler de respuestas, workflows n8n. Ver memorias de `db-migrator`, `integraciones`, `arquitecto-plan`.

## Próximas apuestas — Tier 1 (tangible <30d)
1. **No-show blindado** — conectar el depósito Yape existente (`lib/payments/`) con la cascada de backfill: si no paga la separación en X horas, el cupo se libera a recuperación. *Bajo esfuerzo, conecta lo que ya existe.*
2. **Boleta / Factura electrónica SUNAT** al cobrar — vía OSE (Nubefact/Facturactiva). Pivot validado en el trabajo de campo, aún no construido. *Recurrente y pegajoso.*
3. **"Cierre del lunes"** — WhatsApp semanal al dueño: S/ recuperados, S/ protegidos en depósitos, no-shows evitados, 1 acción sugerida.

## Tier 2 / Moat (requiere densidad de clientes)
- **Benchmarking anónimo** entre clínicas de Lima ("tu no-show está 8 pts sobre el promedio de estética").
- **Marketplace de huecos del día** — cupos ociosos ofrecidos a pacientes nuevos cercanos.

## Fuera de alcance (por ahora)
Ranking con LLM del backfill (el scoring determinístico basta), precios dinámicos, multi-idioma. *(Ver §7 del SPEC.)*
