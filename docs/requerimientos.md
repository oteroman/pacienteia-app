# PacienteIA — Requerimientos del Producto
**Última actualización:** 2026-05-12

> Documento vivo. Reemplaza `resumen_de requerimientos..txt` y complementa `PacienteIA.txt`.
> Refleja el estado real del producto, las prioridades por fase, y los diferenciadores disruptivos.

---

## Visión del Producto

PacienteIA es un **gerente operativo con IA para clínicas en Lima, Perú**. No es un chatbot, no es un CRM genérico. Es un copiloto que:
- Captura y califica leads automáticamente
- Confirma citas y reduce no-shows via WhatsApp
- Reactiva pacientes inactivos antes de que se vayan
- Escuda la reputación online
- Da al dueño visibilidad en tiempo real de lo que pierde y lo que gana

**Diferenciador central vs AgendaPro / Zenoti / Cliniko:**
Ellos son reactivos (gestionan lo que ya pasó). PacienteIA es proactivo (actúa antes de que el paciente se pierda).

**La Regla de Hierro:** La IA NUNCA da diagnósticos, prescripciones, ni consejos de salud.

---

## Estado de Cobertura por Módulo

### ✅ IMPLEMENTADO Y EN PRODUCCIÓN

#### Infraestructura y Plataforma
| Feature | Estado | Notas |
|---------|--------|-------|
| Multi-tenant (org + branch + RLS) | ✅ | RLS con `is_org_member()` |
| Auth email/password + invitación de staff | ✅ | Supabase Auth |
| Roles: owner / admin / staff | ✅ | `org_members` |
| Onboarding wizard de activación | ✅ | `/onboarding` con pasos |
| Superadmin / plataforma | ✅ | `/platform` |
| Cifrado de tokens WhatsApp (AES-256-GCM) | ✅ | `lib/crypto/whatsapp-token.ts` |
| Webhook WhatsApp con validación HMAC | ✅ | `app/api/whatsapp/webhook/route.ts` |
| Deploy en Vercel + env vars | ✅ | `app.pacienteia.com` |

#### Gestión Operativa Core
| Feature | Estado | Notas |
|---------|--------|-------|
| CRUD pacientes | ✅ | Con validación Zod |
| CRUD citas | ✅ | Con profesional, precio, estado |
| Profesionales como entidad propia | ✅ | Con color, especialidad, FK en citas |
| Catálogo de servicios con precio base | ✅ | Picker en formulario de citas |
| Horarios regulares por profesional | ✅ | `doctor_schedules` → `professional_id` FK |
| Bloqueos de fecha (feriados, vacaciones) | ✅ | `schedule_blocks` |
| Gestión de staff (invitar, roles, quitar) | ✅ | `/settings/staff` con invite por email |

#### WhatsApp e Inbox
| Feature | Estado | Notas |
|---------|--------|-------|
| Bandeja unificada WhatsApp + leads | ✅ | `/inbox` |
| Hilo de conversación individual | ✅ | `/inbox/conversations/[id]` |
| Composer de mensajes outbound | ✅ | `MessageComposer.tsx` |
| Recordatorio 24h antes de cita | ✅ | CRON n8n activo |
| Recordatorio 2h antes de cita | ✅ | CRON n8n (pendiente activar en UI) |
| Reply handler: 1=confirmar, 2=reagendar | ✅ | `lib/whatsapp/reminder-reply.ts` |
| Encuesta post-cita automática (4-10h) | ✅ | Rating 1-5 |
| Escudo de reputación (rating 4-5 → Google Reviews) | ✅ | `lib/whatsapp/followup-reply.ts` |
| Alerta interna por paciente insatisfecho (1-3) | ✅ | Crea tarea urgente en copilot |

#### Leads / Captación
| Feature | Estado | Notas |
|---------|--------|-------|
| Webhook de leads (n8n, webform, TikTok) | ✅ | `app/api/webhooks/leads/route.ts` |
| Clasificación automática con IA (Gemini) | ✅ | Intent, prioridad, SLA |
| Lista de leads con filtros por estado pipeline | ✅ | `/leads` |
| Detalle de lead con timeline y acciones | ✅ | `/leads/[id]` |
| Pipeline: Nuevo → En contacto → Esperando → Resuelto | ✅ | Botones de transición de estado |
| Notas internas por lead | ✅ | `intake_events` |
| Convertir lead a paciente (con nombre real) | ✅ | `convertLeadToPatient` |
| Agendar cita desde lead (crea paciente si falta) | ✅ | `scheduleLeadAppointment` |
| SLA indicator (tiempo restante / vencido) | ✅ | Visible en lista y detalle |

#### Reactivación
| Feature | Estado | Notas |
|---------|--------|-------|
| Detección de pacientes inactivos | ✅ | Configurable por días |
| Campaña paso 1: mensaje warm | ✅ | n8n workflow (pendiente activar) |
| Campaña paso 2: follow-up 7 días | ✅ | n8n workflow (pendiente activar) |
| Reply handler: detección de "sí/claro/dale" | ✅ | Crea tarea en copilot |
| Dashboard de reactivación | ✅ | `/analytics/reactivation` |

#### Analytics y Reportería
| Feature | Estado | Notas |
|---------|--------|-------|
| Dashboard operacional (home) | ✅ | KPIs del día, agenda, alertas |
| Funnel leads → citas → completadas | ✅ | `/analytics` con período selector |
| Eficiencia: fill rate, confirmación, SLA, NPS | ✅ | `/analytics` |
| Revenue e ingresos | ✅ | `/analytics/revenue` |
| Métricas de recordatorios y no-shows | ✅ | `/analytics/reminders` |
| NPS y reputación | ✅ | `/analytics/reputation` |
| Dashboard de reactivación | ✅ | `/analytics/reactivation` |

#### Copiloto IA
| Feature | Estado | Notas |
|---------|--------|-------|
| Extracción de tareas desde texto libre | ✅ | Gemini |
| Lista de tareas con prioridad y estados | ✅ | `/copilot` |
| Detalle de tarea | ✅ | `/copilot/tasks/[id]` |
| Tareas automáticas por alertas del sistema | ✅ | Pacientes insatisfechos, SLA vencidos |

---

### 🟡 PARCIALMENTE IMPLEMENTADO

| Feature | Qué tiene | Qué falta |
|---------|-----------|-----------|
| **Reagendamiento** | Reply "2" detectado, estado en DB | UI para proponer y confirmar nuevo horario |
| **Ficha 360 del paciente** | Historial de citas, notas, estado | Conversaciones vinculadas, campañas recibidas, alertas de incidencias |
| **Omnicanalidad** | WhatsApp ✅, TikTok Ads ✅, Webform ✅ | Instagram DM, Facebook DM, Google Business |
| **Score de leads** | Prioridad alta/media/baja por IA | Score visual 0-100, perfil económico estimado |
| **Backfill inteligente** | Página stub existe en nav | Lógica de detección de slots + WhatsApp automático a candidatos |
| **Detección de oportunidades de revenue** | Reactivación para inactivos >60d | Detección por ciclo de retratamiento (ej: Botox cada 3 meses) |
| **Copiloto en WhatsApp** | Tareas desde texto libre | Sugerencia de respuesta en el composer basada en historial del paciente |
| **Plantillas de respuesta rápida** | Sin implementar | Respuestas guardadas reutilizables en el composer |
| **Agenda visual** | Lista de citas con filtros | Vista semanal/diaria por profesional (calendar view) |
| **Reporte de ROI automático** | Dashboard manual | Reporte semanal/mensual auto-enviado por WhatsApp o email al dueño |

---

### ❌ PENDIENTE DE IMPLEMENTAR

#### Alta prioridad (Quick wins + alto impacto)

| # | Feature | Por qué importa | Esfuerzo |
|---|---------|----------------|---------|
| 1 | **Score de retención por paciente** | Predice churn con semanas de anticipación. Reduce abandono 30-40% | Medio |
| 2 | **Reagendamiento completo** | El reply "2" al recordatorio llega pero no hay flujo de confirmación de nuevo horario | Bajo |
| 3 | **Backfill inteligente de slots** | Slot cancelado → WhatsApp automático a candidatos reactivación/espera | Medio |
| 4 | **Sugerencias de respuesta en composer WhatsApp** | Recepcionista responde en segundos con contexto del paciente | Medio |
| 5 | **Agenda calendar view** | Vista semanal/diaria por profesional, arrastrar citas | Alto |

#### Media prioridad

| # | Feature | Por qué importa | Esfuerzo |
|---|---------|----------------|---------|
| 6 | **Flash offers por huecos en agenda** | Llenar slots muertos con descuento automático a pacientes frecuentes | Medio |
| 7 | **Pago de reserva (anti no-show)** | Link Yape/Plin/Niubiz al confirmar cita. No-show cae casi a 0 con depósito previo | Alto |
| 8 | **Cross-selling inteligente** | Si paciente pregunta por dos tratamientos → IA propone paquete combinado | Medio |
| 9 | **Voice-to-Task para staff** | Doctor graba nota de voz → IA crea tarea + agenda control + envía guía al paciente | Alto |
| 10 | **Detección automática de ciclo de retratamiento** | "María hace 90 días que no viene para Botox, contactarla hoy" | Bajo |

#### Largo plazo / Fase avanzada

| # | Feature | Por qué importa |
|---|---------|----------------|
| 11 | **Integración Google Business API** | Detectar reseñas nuevas → sugerir respuesta con IA |
| 12 | **Instagram / Facebook DM** | Omnicanalidad completa — mismo inbox, misma IA |
| 13 | **Voice AI (agente de voz)** | Llamada automática a hot leads que no responden WhatsApp en 15 min |
| 14 | **Voice-to-Clinical Record** | Doctor graba audio → IA genera nota SOAP → guarda en ficha del paciente |
| 15 | **Smart Buffer de agenda** | Si el doctor se retrasa → WhatsApp automático a los próximos pacientes |
| 16 | **Auditor de insumos por foto** | Doctor fotografia vial vacío → IA descuenta stock → alerta si nivel crítico |
| 17 | **Concierge sala de espera** | QR en recepción → WhatsApp con posición en cola + contenido educativo |
| 18 | **Análisis de fugas de marketing** | CPL sube + tasa de confirmación baja = alerta automática al dueño |
| 19 | **Multi-especialidad con derivación** | Paciente consulta por piel y nutrición → IA propone paquete multi-especialista |
| 20 | **App móvil para staff** | Notificaciones push, gestión de agenda desde celular |

---

## Diferenciadores vs Competencia

| Capacidad | AgendaPro | Zenoti | PacienteIA |
|-----------|-----------|--------|------------|
| Agenda + recordatorios | ✅ | ✅ | ✅ |
| WhatsApp nativo (no SMS) | Parcial | No | ✅ |
| Clasificación de leads con IA | No | Parcial | ✅ |
| Reactivación automática | No | Parcial | ✅ |
| Escudo de reputación | No | No | ✅ |
| Score de retención por paciente | No | No | 🚧 próximo |
| Copiloto en conversaciones | No | No | 🚧 próximo |
| Español peruano, Yape/Plin | No | No | 🚧 próximo |
| Voice-to-clinical-record | No | Parcial (US) | 📋 backlog |

---

## Configuración Operativa de Clínica (Ajustes)

| Configuración | Estado |
|--------------|--------|
| Datos de la clínica (nombre, dirección, teléfono) | ✅ `/settings/clinic` |
| Catálogo de tratamientos con precio y duración | ✅ `/settings/services` |
| Profesionales con color y especialidad | ✅ `/settings/professionals` |
| Horarios semanales por profesional | ✅ `/settings/schedules` |
| Bloqueos de fecha (feriados, vacaciones) | ✅ `/settings/schedules` |
| Configuración WhatsApp (token, Google Review URL) | ✅ `/settings/whatsapp` |
| Gestión de staff (invitar, roles, quitar) | ✅ `/settings/staff` |
| Activar/desactivar automatizaciones | ❌ Pendiente |
| Editar plantillas de mensajes | ❌ Pendiente |
| Buffers de tiempo entre citas | ❌ Pendiente |
| Tono de marca configurable | ❌ Pendiente |
| Políticas anti no-show (depósito) | ❌ Pendiente |

---

## Especialidades y Restricciones

| Especialidad | Restricción | Feature especial |
|--------------|-------------|-----------------|
| Clínicas estéticas | Sin consejo médico | Ciclos de retratamiento (Botox 3m, rellenos 6m) |
| Odontología | Sin diagnósticos | Planes multi-sesión, tracking de sesiones |
| Psicología | NUNCA revelar motivo de consulta | Máxima privacidad en mensajes automáticos |
| Consultorios médicos | Sin diagnósticos | Solo gestión operativa |

---

## Pendientes Operativos (No técnicos)

| # | Tarea | Responsable |
|---|-------|------------|
| 1 | Token WhatsApp permanente (System User en Meta Business Manager) | Cliente |
| 2 | Activar workflow n8n `zrg6OeyKQDxsScpq` (recordatorio 2h) | Manual en n8n UI |
| 3 | Activar workflows reactivación (`re29X6GI7IW9fooG`, `h8gdAFoCKl1nT2Wy`) | Manual en n8n UI |
| 4 | Configurar Google Review URL en Ajustes → WhatsApp | Cliente |

---

## Referencias de Mercado

- **Zenoti** (EE.UU.) — AI Workforce: AI Receptionist, AI Lead Manager, AI Concierge. El más completo globalmente.
- **AgendaPro** (México/LATAM) — Agenda + recordatorios para estética. Sin IA real de retención.
- **Kickcall** (EE.UU.) — AI Voice Agent. Reduce no-shows 70%. Modelo puro de voice.
- **AInora** (Europa) — AI Receptionist para salones/spas. 20-35% menos no-shows.
- **Cliniko / Jane App** (Australia/Canadá) — CRM clínico completo. Sin WhatsApp nativo.

**Oportunidad en Perú:** Ninguno de estos está tropicalizado para Lima (WhatsApp, Yape/Plin, español peruano, clínicas pequeñas <5 personas). PacienteIA tiene ventana de 12-18 meses antes de que lleguen.
