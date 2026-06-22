# PacienteIA — Solución Completa: Estado, Visión y Plan de Implementación

> Documento maestro actualizado al 2026-06-12 (rev 8 — documentados módulos que vivían solo en el working tree: Rebooking, Concierge de Sala de Espera, Ops cross-sistema, Renewal Signals, Value/ROI, consolas de plataforma. Consolidación a git + saneamiento de secretos del fuente).
> Consolida: Idea de Negocio, PacienteIA.txt, requerimientos.md, resumen_de_requerimientos.txt y el estado real del producto.

---

## 1. Qué es PacienteIA

PacienteIA es un **gerente operativo con IA para clínicas en Lima, Perú**. No es un chatbot, no es un CRM genérico.

**Propuesta de valor en una línea:**
> Un manager operativo con IA que recupera pacientes perdidos, agenda automáticamente, confirma citas y hace seguimiento post-tratamiento para clínicas, todo vía WhatsApp, sin estrés para el staff.

**Diferenciador central vs AgendaPro / Zenoti / Cliniko:**
Ellos son **reactivos** — gestionan lo que ya pasó. PacienteIA es **proactivo** — actúa antes de que el paciente se pierda.

**La Regla de Hierro (no negociable):** La IA NUNCA da diagnósticos, prescripciones, ni consejos de salud. Solo gestiona operaciones.

---

## 2. Contexto de Mercado

| Competidor | Fortaleza | Debilidad para LATAM |
|-----------|-----------|---------------------|
| **Zenoti** (EE.UU.) | AI Workforce completo: receptionist, concierge, lead manager | No hispanohablante, no WhatsApp nativo, caro para pymes |
| **AgendaPro** (México) | Agenda + recordatorios en español | Sin IA real de retención ni reactivación |
| **Kickcall** (EE.UU.) | AI Voice Agent, reduce no-shows 70% | Solo voz, no WhatsApp, no español |
| **AInora** (Europa) | AI Receptionist para salones | No en español, no tropicalizado |
| **Cliniko / Jane App** | CRM clínico completo | Sin WhatsApp nativo, sin IA de retención |

**Ventana de oportunidad en Perú:** 12-18 meses antes de que estas plataformas lleguen tropicalizadas.
PacienteIA tiene lo que ninguno tiene: WhatsApp nativo en español peruano, Yape/Plin (próximo), y precio para clínicas de 1-10 personas.

### Validación de mercado con datos reales

- No-shows del 15-30% son normales en salones/spas/clínicas estéticas en Lima
- Un salón de 6 sillas pierde hasta USD 400,000/año en revenue por no-shows (Phorest 2025)
- Con IA de confirmaciones: no-shows bajan de 22% a 10% → recuperación USD 45,000-72,000/año
- AgendaPro reporta 30-40% de aumento en ventas con recomendaciones personalizadas
- Kickcall reporta 70% reducción de no-shows y USD 180K anuales recuperados en un caso

---

## 3. Lo que ya está construido ✅

### F0 — Infraestructura Base (producción)

| Feature | Detalle |
|---------|---------|
| Multi-tenant (org + branch + RLS) | RLS con `is_org_member()`, aislamiento estricto entre tenants |
| Auth email/password + invitación de staff | Supabase Auth, invites por email |
| Roles: owner / admin / staff | `org_members` con scope por branch |
| Onboarding wizard de activación | `/onboarding` con pasos guiados |
| Superadmin / plataforma | `/platform` para gestión de tenants |
| Cifrado de tokens WhatsApp (AES-256-GCM) | `lib/crypto/whatsapp-token.ts`, IV aleatorio |
| Webhook WhatsApp con validación HMAC | `app/api/whatsapp/webhook/route.ts` |
| Multi-App WhatsApp (HMAC per-clínica) | Cada clínica usa su propia App Meta — facturación independiente |
| Deploy en Vercel | `app.pacienteia.com` |

### F0 — Gestión Operativa Core

| Feature | Detalle |
|---------|---------|
| CRUD pacientes | Validación Zod, búsqueda, paginación |
| CRUD citas | Con profesional, precio, estado, notas inline |
| Profesionales como entidad propia | Color picker, especialidad, FK en citas y horarios |
| Catálogo de servicios con precio base y ciclo de retratamiento | Picker en formulario de citas |
| Horarios semanales por profesional | `doctor_schedules` vinculado a `professionals` — validados al agendar citas |
| Bloqueos de fecha (feriados, vacaciones) | `schedule_blocks` — impiden agendar citas en fechas/horarios bloqueados |
| Gestión de staff (invitar, roles, quitar) | `/settings/staff` con invite por email |
| Configuración WhatsApp por branch | Token cifrado, Google Review URL, App Secret propio |
| **Expediente Operativo del Paciente** | Contraindicaciones/alergias (campo dedicado ⚠), fotos antes/después con galería y lightbox, consentimiento informado imprimible, timeline de citas con profesional |

### F1.1 — Inbox WhatsApp y Leads (producción)

| Feature | Detalle |
|---------|---------|
| Bandeja unificada WhatsApp + leads | `/inbox` con filtros por intent |
| Hilo de conversación individual | `/inbox/conversations/[id]` |
| Composer de mensajes outbound | Envío vía Cloud API |
| Webhook de leads (n8n, webform, TikTok) | `app/api/webhooks/leads/route.ts` |
| Clasificación automática con IA (Gemini) | Intent, prioridad, SLA en ≤30 segundos |
| Pipeline de leads: Nuevo → En contacto → Esperando → Resuelto | Botones de transición, notas, timeline |
| Convertir lead a paciente y agendar | Un click en `/leads/[id]` |
| SLA indicator (tiempo restante / vencido) | Visible en lista y detalle |

### F1.2 — Recordatorios y Confirmaciones (producción)

| Feature | Detalle |
|---------|---------|
| Recordatorio 24h antes de cita | CRON n8n activo `Yp1PyCvHvMBuzySR` |
| Recordatorio 2h antes de cita | CRON n8n `zrg6OeyKQDxsScpq` (pendiente activar) |
| Reply handler: 1=confirmar, 2=reagendar | `lib/whatsapp/reminder-reply.ts` |

### F1.3 — Post-Cita y Escudo de Reputación (producción)

| Feature | Detalle |
|---------|---------|
| Encuesta post-cita automática 4-10h después de atención | Rating 1-5 por WhatsApp |
| Rating 4-5 → link Google Reviews | Solo los felices van a Google |
| Rating 1-3 → alerta interna urgente | Crea tarea copilot priority:high |
| Dashboard NPS y reputación | `/analytics/reputation` |
| Configuración Google Review URL | `/settings/whatsapp` |

### F2 — Reactivación de Pacientes Inactivos (producción)

| Feature | Detalle |
|---------|---------|
| Campaña paso 1: mensaje warm a inactivos | n8n workflow `re29X6GI7IW9fooG` (pendiente activar) |
| Campaña paso 2: follow-up 7 días después | n8n workflow `h8gdAFoCKl1nT2Wy` (pendiente activar) |
| Reply handler: detección de "sí/claro/dale" | Marca respondido + crea tarea copilot |
| Dashboard de reactivación | `/analytics/reactivation` — embudo, KPIs, tabla |

### F3 — Analytics e Inteligencia Operativa (producción)

| Feature | Detalle |
|---------|---------|
| Dashboard operacional (home) | KPIs del día, agenda clicable, alertas, WhatsApp sin leer |
| Funnel leads → citas → completadas | `/analytics` con período selector |
| Revenue e ingresos | `/analytics/revenue` |
| Métricas de recordatorios y no-shows | `/analytics/reminders` |
| Score de retención por paciente (0-100) | Fiel / Estable / En riesgo / Riesgo alto. Ficha + lista |
| Widget "En riesgo de abandono" en dashboard | Pacientes sin visita >60 días |
| Oportunidades de revenue (ciclo de retratamiento) | Detecta pacientes con ciclo vencido — `/opportunities` |
| Widget de oportunidades en dashboard | Pill de alerta con count |

### Diferenciadores Disruptivos — Ya Implementados

| # | Feature | Detalle |
|---|---------|---------|
| 1 | **Score de Retención por Paciente** | Algoritmo 0-100: recencia, inasistencias, lealtad, próxima cita |
| 2 | **Copiloto de Recepcionista (Sugerencias IA en Inbox)** | Botón "✨ Sugerencia IA" en composer — Gemini con historial completo |
| 3 | **Oportunidades de Revenue** | Ciclo de retratamiento por servicio → detección automática |
| 4 | **Reputación** | NPS + escudo Google Reviews (Google Business API pendiente OAuth) |
| 5 | **NLU Avanzado en Conversaciones** | 9 intents en tiempo real, auto-respuestas, tareas copilot, filtros en inbox |
| 6 | **Backfill Inteligente de Slots** | Cancelación → contacta candidatos de reactivación e intakes automáticamente |
| 7 | **Auto-Agendamiento desde WhatsApp** | Paciente elige servicio y slot desde WhatsApp, cita creada directamente |
| 8 | **Inbox Mobile-First** | Breakpoint `lg:` (1024px): tablet y móvil ven un panel a la vez, igual que WhatsApp |
| 9 | **Plantillas base pre-cargadas** | 15 plantillas curadas en 6 categorías, disponibles desde el primer día |
| 10 | **Landing V3 (pacienteia.com)** | Next.js `'use client'`, logo oficial, CTA → Paxi WA, diseño Sky-500 + Violet |
| 11 | **Design System DESIGN.md** | Brandbook completo: tokens Tailwind (brand/ai/lima/ink/mist/fog/slate), CSS custom properties, tipografía Inter + JetBrains Mono, 92+ archivos actualizados |
| 12 | **Vista de Crecimiento Mensual** | `/analytics/growth` — selector 3/6/12 meses, KPIs acumulados, gráfico de barras CSS, tabla mes a mes. Para que el dueño sienta el valor acumulado de la plataforma |

### Redes Sociales y Omnicanalidad — Ya Implementado ✅ (2026-05-15)

| Feature | Detalle |
|---------|---------|
| **OAuth Facebook/Instagram por clínica** | Ajustes → Redes Sociales → Conectar: intercambia code por long-lived page token, guarda en `social_connections` |
| **Facebook Messenger en Inbox** | Mensajes de Messenger de la Página de la clínica → misma bandeja que WhatsApp, mismo composer |
| **Instagram DMs en Inbox** | DMs de IG de negocio (vinculado a la Página de Facebook) → inbox unificado. Auto-detectado en el OAuth |
| **Lead Ads de Facebook → Pipeline** | Webhook `leadgen` → fetch de Graph API → `processIntake` con `channel:'facebook'` |
| **TikTok Lead Gen → Pipeline** | Webhook `/api/intake/tiktok` + campo oculto `clinic_id` → intake automático |
| **Badge de canal en conversación** | "WhatsApp", "Facebook Messenger", "Instagram DM" visible en hilo y lista |
| **Reply desde PacienteIA en todos los canales** | `sendMessage` en `app/actions/conversations.ts` enruta por canal: WA / FB / IG |
| **Paxi multi-canal** | Prospectos que escriben a la Página de PacienteIA por Messenger o IG son atendidos por el bot Paxi |
| **Panel `/platform/social`** | Superadmin ve KPIs, conexión de página propia, tabla de conexiones de clientes y desglose de leads sociales |
| **Seguridad: RLS en tablas de plataforma** | `sales_prospects`, `sales_messages`, `platform_crm_notes` con RLS activo — acceso solo via service role |
| **Fix middleware platform admin** | Rutas `/api/*` ahora son accesibles para platform admins sin impersonation |

### Plataforma SaaS y Crecimiento

| Feature | Detalle |
|---------|---------|
| **Vendedor IA (Paxi)** | Bot WhatsApp que capta y califica prospectos de PacienteIA. 7 pasos conversacionales. Pipeline en `/platform/sales` |
| **Multi-App WhatsApp** | Cada clínica con su propia App Meta. HMAC per-branch. Onboarding independiente |
| **Google Business Reputation (infra lista)** | OAuth flow, tabla `google_business_connections`, CRON de reseñas, sugerencia de respuesta IA |
| **Platform Roles** | superadmin / support / sales — nav filtrado por rol, CRM comercial para equipo de ventas |
| **Billing UI + Pricing page** | `/billing` — uso del mes, features por plan, banners de upgrade. `/pricing` — S/99/249/499 |
| **Plan gating completo** | `isFeatureAllowed()` protege: `/backfill` (Pro+), `/opportunities` (Premium), `/analytics/reactivation` (Pro+), `/analytics/revenue` (Premium), `/analytics/growth` (Premium). CSV export y web forms con gate en UI. |
| **CSV Export** | `/api/export/patients` + `/api/export/leads` gateados con `csv_export` (Pro+). Botón visible en ambas páginas. |
| **Web Forms embed** | `/settings/webforms` con snippet HTML + instrucciones. Gate `web_forms` (Pro+). |
| **Voice-to-Task Staff** | Staff graba nota de voz en WA → Gemini transcribe + extrae entidades → copilot_task + mensaje WA al paciente. `org_members.whatsapp_phone` detecta al staff. `lib/voice/transcribe.ts` + `handle-staff-voice.ts`. |
| **API Pública + API Keys** | Tabla `api_keys` (SHA-256, prefijo `paia_`). `lib/api/keys.ts`: `generateApiKey()` y `validateApiKey()`. `app/actions/api-keys.ts`: crear y revocar scoped a org. `/settings/api-keys` (gate `api_webhooks`, Premium): UI con creación, revocación y docs inline; raw key visible solo una vez via `?new_key=`. 3 endpoints: `GET /api/v1/patients` (`?q`, `?limit`), `GET /api/v1/appointments` (`?date`, `?status`, `?limit`), `POST /api/v1/leads` (source_channel: 'api', SLA 30min). Auth por header `X-API-Key`; `/api/v1/` excluido del middleware de sesión. |
| **Onboarding diferenciado por rubro** | Rubro viaja como `?industry=` en cada redirect entre steps del wizard. Step 1 pre-selecciona el rubro. Steps 2-3 propagan el rubro con `<input type="hidden">`. Step 4 muestra features específicas según rubro: estética (ciclos retratamiento, reputación), dental (planes multi-sesión, tracking), psicología (mensajes neutros, privacidad), medicina (derivaciones, seguimiento). Landing modal "Prueba Gratis" incluye CTA secundario "Registrarme directamente →" que lleva a `https://app.pacienteia.com/signup?industry={rubro}`. |

### Operación Avanzada y Consolas de Plataforma — Ya Implementado ✅ (documentado 2026-06-12)

> Estos módulos existían en el código y en producción pero no estaban en la documentación. Se descubrieron al consolidar el working tree a git.

| Feature | Detalle |
|---------|---------|
| **Rebooking** | `/rebooking` — tablero de recuperación de cancelaciones, no-shows y silencios. `lib/rebooking/index.ts` (`fetchRebookingDashboard`: cancelled, noResponse, slotsFreed, resolvedToday) + `app/actions/rebooking.ts`. Pill de pendientes en el header |
| **Concierge de Sala de Espera** | `/waiting-room` — cola en vivo (tabla `waiting_queue`): posición, estados `waiting`/`called`, hora de ingreso y de llamada. `/settings/waiting-room` genera un **QR imprimible** para que el paciente se autoregistre. `app/actions/waiting-room.ts`. (Era la idea "Concierge de Sala de Espera" de Fase 7 — ya construida) |
| **Ops (cross-sistema)** | `/ops` — vista unificada intake → inbox → copiloto → resolución: stats operativos, escalaciones, follow-ups pendientes, eventos recientes y performance comparada de clínicas |
| **Renewal Signals** | `/renewal` (**solo platform admins**) — señales cross-org: `renewal_risk`, `expansion_ready`, `expansion_low_hanging`, `healthy_renewal`, `renewal_watch`, `inactive`. `fetchRenewalSignals` + `SIGNAL_META` en `lib/analytics/signals.ts` |
| **Value / ROI** | `/value` y `/analytics/value` — valor generado y ROI estimado con metodología conservadora para el mercado de Lima. Refuerzan el "valor acumulado percibido" por el dueño |
| **Customer Health / Playbook** | `/analytics/health` (Customer Health) y `/analytics/playbook` (guía de acciones recomendadas) |
| **Consolas de plataforma** | `/platform/mrr` (Revenue & Growth: MRR, activación y oportunidades en tiempo real), `/platform/trials` (cuentas en prueba), `/platform/audit` (auditoría de acciones de admins), `/platform/crm` (CRM comercial: prospectos asignados y clientes captados), `/platform/admins` (equipo de plataforma superadmin/support/sales) |

---

## 4. Lo que falta por construir

### Prioridad 1 — Quick Wins de Alto Impacto

| # | Feature | Estado | Esfuerzo |
|---|---------|--------|---------|
| ~~P1.1~~ | ~~**Reagendamiento completo**~~ | ✅ 2026-05-13 | — |
| ~~P1.2~~ | ~~**Google Business API**~~ | ✅ Infra lista — pendiente config env vars en Vercel | — |
| ~~P1.3~~ | ~~**Reporte de ROI automático semanal**~~ | ✅ 2026-05-14 (Sprint 5.1) | — |
| ~~P1.4~~ | ~~**Flash Offers: llenar huecos de agenda**~~ | ✅ 2026-05-14 (Sprint 4.4) | — |
| ~~P1.5~~ | ~~**Plantillas de respuesta rápida**~~ | ✅ 2026-05-13 | — |

### Prioridad 2 — Diferenciadores de Conversión

| # | Feature | Estado | Esfuerzo |
|---|---------|--------|---------|
| ~~P2.1~~ | ~~**Pago de reserva anti no-show**~~ | ✅ 2026-05-14 | — |
| ~~P2.2~~ | ~~**Smart Buffer de Agenda**~~ | ✅ 2026-05-14 | — |
| ~~P2.3~~ | ~~**Cross-selling inteligente**~~ | ✅ 2026-05-14 | — |
| ~~P2.4~~ | ~~**Calendario visual (drag & drop)**~~ | ✅ 2026-05-16 — drag & drop nativo HTML5, ghost slot, offset compensado | — |
| ~~P2.5~~ | ~~**Activar/desactivar automatizaciones**~~ | ✅ 2026-05-14 | — |
| ~~P2.6~~ | ~~**Editar plantillas de mensajes**~~ | ✅ 2026-05-13 | — |

### Prioridad 3 — IA Avanzada y Omnicanalidad

| # | Feature | Estado | Esfuerzo |
|---|---------|--------|---------|
| ~~P3.1~~ | ~~**Voice-to-Task para Staff**~~ | ✅ 2026-05-15 — `lib/voice/`, gate por `org_members.whatsapp_phone`, Gemini multimodal, copilot_task | — |
| ~~P3.2~~ | ~~**Analizador de Fugas de Marketing**~~ | ✅ 2026-05-16 — `/analytics/marketing`: 4 KPI cards (ad spend 7d/30d, CPL 7d vs baseline 30d, tasa confirmación), alerta roja cuando CPL > baseline×1.3 o confirmación < 20%, CSS bar chart 30d, form registro gasto, tabla historial con delete, alertas históricas. CRON `/api/internal/marketing-alerts` envía WA al owner. Tablas `ad_spend` + `marketing_alerts`. `lib/analytics/marketing.ts` + `app/actions/marketing.ts`. Migración `20260516000002_marketing_analytics.sql`. | — |
| ~~P3.3~~ | ~~**Instagram / Facebook DM en inbox**~~ | ✅ 2026-05-15 — Messenger + Instagram DMs + Lead Ads + TikTok Lead Gen | — |
| ~~P3.4~~ | ~~**Bitácora / Trazabilidad visible**~~ | ✅ 2026-05-16 — `/activity`: Server Component, historial 30d de eventos fusionados (citas appointment_events + tareas IA copilot_tasks + recordatorios enviados), agrupados por día, badges por tipo (teal=recordatorio, violet=tarea IA, green/red/amber=eventos de cita), links directos a `/appointments/[id]` y `/copilot/tasks/[id]`. Entrada en nav bajo grupo Copiloto IA. | — |
| ~~P3.5~~ | ~~**Ficha 360 del Paciente**~~ | ✅ 2026-05-14 | — |

### Prioridad 4 — Innovación Disruptiva (meses 6-18)

| # | Feature | Por qué importa | Esfuerzo |
|---|---------|----------------|---------|
| P4.1 | **Voice-to-Clinical Record** | Doctor graba audio 30s → IA transcribe → formato SOAP → ficha del paciente. Cumplimiento legal sin tipear | Alto |
| ~~P4.2~~ | ~~**Concierge de Sala de Espera**~~ | ✅ Implementado — `/waiting-room` (cola en vivo `waiting_queue`) + `/settings/waiting-room` (QR de autoregistro). Falta solo contenido educativo del tratamiento | — |
| P4.3 | **Auditor de Insumos por Foto** | Foto del vial vacío → IA reconoce producto → descuenta stock → alerta si nivel crítico. Anti-robo | Alto |
| P4.4 | **Voice AI Receptionist 24/7** | Llamada automática a hot leads que no responden WhatsApp en 15 min. Convierte llamadas perdidas | Muy alto |
| P4.5 | **Multi-especialidad con Derivación** | Paciente consulta por piel y nutrición → IA propone paquete multi-especialista → aumenta LTV | Alto |
| ~~P4.6~~ | ~~**Predictor de Abandono por Sentimiento**~~ | ✅ 2026-05-14 | — |
| P4.7 | **App Móvil para Staff** | Notificaciones push, gestión de agenda y leads desde celular | Muy alto |
| P4.8 | **Dynamic Pricing / Flash Sale IA** | Detecta horas muertas → precio diferencial automático → WhatsApp a lista de espera | Medio |

---

## 5. Ideas Disruptivas e Innovadoras

Estas son las propuestas que no existen en ningún competidor de LATAM. Son el motor de diferenciación de largo plazo.

### 🔥 Idea A — "Analizador de Fugas Dinámico" (Revenue Recovery en Tiempo Real)

**Problema:** Las clínicas invierten en ads (Facebook/IG) pero no saben si el staff está perdiendo leads calientes por no responder a tiempo.

**La solución:**
- Cruzar inversión en pauta (webhook de Meta Ads) con leads que entran y estado de cita en Supabase
- Si CPL sube + tasa de confirmación baja del umbral (ej: 20%): alerta automática al dueño: *"Estás perdiendo S/ 500 hoy en anuncios porque el staff no está respondiendo los leads 'Hot' en menos de 5 minutos"*

**Impacto:** PacienteIA pasa de ser un gasto de software a ser el guardián del presupuesto de marketing.

---

### 🔥 Idea B — "Smart Multi-Agent" para Derivación Médica (Cross-selling Clínico)

**Problema:** Las clínicas tienen múltiples especialistas pero ningún sistema detecta automáticamente que un paciente necesita servicios combinados.

**La solución:**
- Usar Gemini no solo para clasificar, sino para perfilar y derivar
- Si un paciente pregunta por "manchas en la piel" y "dieta" → el sistema crea automáticamente un "Plan Integral" y ofrece paquete de evaluación conjunta
- Score de LTV estimado al primer contacto

**Impacto:** Ningún bot estándar hace cross-selling clínico inteligente basado en historial de conversación. Incrementa LTV desde el primer contacto.

---

### 🔥 Idea C — "Voice-to-Task" para el Staff (Hands-Free Clinic) ← PRÓXIMO SPRINT

**Problema:** Las recepcionistas y médicos en Lima están atendiendo y no tienen tiempo de llenar el CRM.

**La solución:**
- El médico o recepcionista graba una nota de voz en WhatsApp desde su número registrado como staff
- PacienteIA detecta que el remitente es staff (via `org_members`) y no lo trata como paciente
- Gemini transcribe el audio y extrae: paciente, acción a realizar, fecha/hora, mensaje a enviar
- El sistema ejecuta automáticamente: crea copilot_task, agenda cita, envía guía al paciente
- Confirmación al médico: *"Entendido. Agendé control para Alessandra el 28/05 a las 10am y le envié la guía de cuidados"*

**Implementación técnica:**
- `lib/voice/transcribe.ts` → descarga audio de Meta Cloud API → Gemini `inlineData` (soporta MP3/OGG/M4A)
- `lib/voice/parse-task.ts` → Gemini extrae entidades estructuradas del texto
- Routing en webhook: `media_type === 'audio'` + remitente es staff → `handleStaffVoiceNote()`

**Impacto:** El sistema se alimenta solo mediante la voz del personal. Elimina la fricción administrativa por completo. **Ningún competidor en LATAM lo tiene.**

---

### 🔥 Idea D — "Predictor de Abandono por Análisis de Sentimiento"

**Problema:** El churn de pacientes ocurre semanas antes de que el paciente lo comunique.

**La solución:**
- Analizar no solo QUÉ dice el paciente, sino CÓMO lo dice (tono, entusiasmo, dudas)
- Gemini detecta señales de abandono en mensajes de WhatsApp
- Si probabilidad de abandono alta: sistema dispara un "Gesto de Fidelización" automático → cupón de descuento o llamada prioritaria con el médico

**Impacto:** Detiene la pérdida antes de que suceda. Reducción de churn 30-40%.

---

### 🔥 Idea E — "Cero Fricción en Pagos" (Exclusivo Perú)

**Problema:** No existe en ninguna solución de EE.UU. porque usan Square/Stripe. En Perú, Yape/Plin es el método de pago dominante.

**La solución:**
- Al confirmar la cita, el sistema envía: *"Para asegurar tu cupo, puedes separar tu cita con S/ 50 aquí [Link de Pago Yape/Plin/Niubiz]"*
- El compromiso financiero (aunque sea pequeño) reduce no-shows casi a 0
- Integración con Niubiz/Izipay para vencimiento de reserva y conciliación automática

**Impacto:** El diferenciador más poderoso para el mercado peruano. Ningún competidor lo tiene.

---

### 🔥 Idea F — "Auditor de Insumos Inteligente" (Anti-Robo)

**Problema:** El mayor dolor oculto en clínicas estéticas es el control de stock de productos caros (toxinas, viales, rellenos). Las hojas de Excel nadie las llena.

**La solución:**
- El médico fotografía el vial vacío o el empaque por WhatsApp al terminar un procedimiento
- n8n usa IA de visión para reconocer el producto, descuenta una unidad del inventario en Supabase
- Si el stock llega al nivel crítico: alerta automática al proveedor o al dueño

**Impacto:** Elimina las "pérdidas misteriosas" de insumos de alto valor. Nuevo módulo de inventario que solo existe en PacienteIA.

---

### 🔥 Idea G — "Concierge de Sala de Espera"

**Problema:** En Lima, el tráfico y los retrasos son constantes. Los pacientes que esperan se ponen de mal humor y bajan el NPS.

**La solución:**
- QR code en la recepción que el paciente escanea al llegar
- WhatsApp automático le da bienvenida, le informa cuántas personas hay delante y le ofrece contenido educativo sobre su tratamiento (ej: video de cuidados post-láser)
- Si hay retraso del médico: mensaje automático ajusta la expectativa proactivamente

**Impacto:** Reduce percepción de tiempo de espera y educa al paciente. Mejora NPS sin intervención del staff.

---

### 🔥 Idea H — "Voice AI Receptionist" 24/7

**Problema:** El 15-25% de clientes potenciales se pierde por llamadas no contestadas fuera de horario.

**La solución:**
- Agente de voz que responde llamadas 24/7
- Agenda automáticamente, responde preguntas frecuentes, convierte llamadas perdidas en citas confirmadas
- Si hot lead no responde WhatsApp en 15 min: llamada automática de voz

**Impacto:** Zenoti ya cobra por esto en EE.UU. Kickcall reporta 70% reducción de no-shows. En Perú no existe.

---

## 6. Plan de Implementación hacia Adelante

### Fase 4 — Cierre de Gaps Críticos (semanas 1-4)
*Objetivo: completar flujos a medias y activar pendientes operativos*

**Sprint 4.1 — Activación de Workflows n8n (Semana 1)**
- [ ] Activar `zrg6OeyKQDxsScpq` (recordatorio 2h) en n8n UI
- [ ] Activar `re29X6GI7IW9fooG` + `h8gdAFoCKl1nT2Wy` (reactivación) en n8n UI
- [ ] Activar `02qXai5oiYbKQwMo` (encuesta post-cita) en n8n UI
- [ ] Conectar Google OAuth en Vercel para Google Business API
- [ ] Configurar token WhatsApp permanente (System User en Meta BM)

**Sprint 4.2 — Reagendamiento Completo ✅ (2026-05-13)**
- [x] Cuando paciente responde "2" al recordatorio: slots disponibles enviados automáticamente — `lib/whatsapp/reminder-reply.ts`
- [x] Paciente elige slot → cita actualizada + confirmación enviada — `lib/whatsapp/reschedule.ts` → `handleRescheduleSelection`
- [x] Si no elige en 2h: escalación a copilot_task — `app/api/internal/reschedule-escalation/route.ts`
- [x] Webhook integrado: `handleRescheduleSelection` corre antes que `handleReminderReply` — `app/api/whatsapp/webhook/route.ts`

**Sprint 4.3 — Plantillas de Respuesta Rápida ✅ (2026-05-13)**
- [x] Tabla `message_templates` (name, body, category, branch_id, is_active) — `supabase/migrations/20260513000003_message_templates.sql`
- [x] Server Actions: `createTemplate`, `deleteTemplate`, `toggleTemplateActive` — `app/actions/message-templates.ts`
- [x] API `GET /api/templates?conversation_id=` para el composer — `app/api/templates/route.ts`
- [x] UI en `/settings/messages` para crear/activar/desactivar/eliminar plantillas agrupadas por categoría
- [x] Picker de plantillas en MessageComposer — carga lazy al primer click, agrupado por categoría, clic aplica al textarea
- [x] "Plantillas" agregado al nav de Configuración — `components/nav-header.tsx`

**Sprint 4.4 — Flash Offers para Huecos de Agenda ✅ (2026-05-14)**
- [x] Tabla `flash_offers` — `supabase/migrations/20260514000001_flash_offers.sql`
- [x] `lib/whatsapp/flash-offers.ts` — detección de slots vacíos, selección de candidatos, message builder
- [x] `lib/whatsapp/flash-offer-reply.ts` — reply handler: SÍ → crea cita + confirma
- [x] `app/api/internal/flash-offers/route.ts` — CRON POST con automation toggle
- [x] Webhook integrado con `handleFlashOfferReply`

---

### Fase 5 — Diferenciadores de Conversión (semanas 5-10)

**Sprint 5.1 — Reporte de ROI Automático ✅ (2026-05-14)**
- [x] `lib/analytics/roi-report.ts` — `generateRoiReport()` + `buildRoiMessage()`: reactivaciones, recordatorios confirmados, flash offers, citas WA, revenue estimado, tiempo de respuesta a leads
- [x] `app/api/internal/roi-report/route.ts` — POST envía reporte por WA al owner; GET devuelve JSON para preview
- [x] n8n: crear workflow lunes 8AM Lima → POST `/api/internal/roi-report`

**Sprint 5.2 — Smart Buffer de Agenda ✅ (2026-05-14)**
- [x] Tabla `delay_warnings` — `supabase/migrations/20260514000002_delay_warnings.sql`
- [x] `app/api/internal/smart-buffer/route.ts` — detecta citas running over time (+10 min), notifica siguiente paciente, registra warning para evitar duplicados
- [x] Con automation toggle para poder pausarlo desde `/settings/automations`

**Sprint 6.1 — Cross-selling Inteligente ✅ (2026-05-14)**
- [x] NLU ampliado con intent `multi_service_interest` — detecta cuando paciente pregunta por 2+ servicios en un mensaje
- [x] TASK_CONFIG: crea copilot_task "Oportunidad cross-selling" con prioridad medium en el inbox del staff
- [x] Prompt Gemini actualizado con definición del nuevo intent

**Sprint 6.3 — Predictor de Abandono por Sentimiento ✅ (2026-05-14)**
- [x] `supabase/migrations/20260514000004_patient_abandonment_risk.sql` — columnas `abandonment_risk` + `abandonment_risk_at` en `patients`
- [x] `app/api/internal/abandonment-prediction/route.ts` — CRON semanal; analiza últimos 10 mensajes por paciente con Gemini; score 0-100; crea copilot_task si score ≥ 65
- [x] Badge de riesgo visible en ficha del paciente (header + tarjeta de retención)
- [x] n8n: crear workflow domingos 11PM Lima → POST `/api/internal/abandonment-prediction`

**Sprint P3.5 — Ficha 360 del Paciente ✅ (2026-05-14)**
- [x] `app/(dashboard)/patients/[id]/page.tsx` — nueva ficha con 5 secciones: Score de retención (con riesgo abandono), Tareas IA relacionadas, Conversaciones WhatsApp, Campañas automáticas recibidas, Historial de citas
- [x] Cross-branch: queries sin filtro `branch_id` — muestra actividad de todas las sucursales de la misma org
- [x] Links directos a conversaciones y tareas desde la ficha

**Sprint P2.1 — Pago de Reserva Anti No-Show ✅ (2026-05-14)**
- [x] `supabase/migrations/20260514000006_payment_settings.sql` — columnas de pago en `branch_whatsapp_config` + `payment_status/link/order_id/paid_at` en `appointments`
- [x] `lib/payments/index.ts` — dispatcher: `none` → no-op · `qr_image` → envía imagen QR · `niubiz` → genera link y envía
- [x] `lib/payments/niubiz.ts` — integración Niubiz "Cobro con Link" (auth + generación de link)
- [x] `lib/whatsapp/send.ts` — `sendWhatsAppImage()` para envío de imagen QR
- [x] `app/api/webhooks/niubiz/route.ts` — webhook de confirmación automática; actualiza cita a `paid` + envía WA al paciente
- [x] `app/actions/payment-settings.ts` — `savePaymentSettings` + `confirmPaymentManual`
- [x] `app/(dashboard)/settings/payments/page.tsx` — selector de método (ninguno / QR / Niubiz), monto, URL de QR, credenciales Niubiz, webhook URL
- [x] `components/nav-header.tsx` — "Pagos" agregado al menú de Configuración
- [x] `lib/whatsapp/booking-flow.ts` — dispara pago tras crear cita en booking flow
- [x] `lib/whatsapp/reminder-reply.ts` — dispara pago al confirmar con "1"
- [x] `app/(dashboard)/appointments/[id]/page.tsx` — badge de estado de pago + botón "Marcar pago recibido" (flujo QR manual)

**Sprint 5.4 — Analizador de Fugas de Marketing ✅ (2026-05-16)**
- [x] Tablas `ad_spend` + `marketing_alerts` — `supabase/migrations/20260516000002_marketing_analytics.sql`
- [x] `lib/analytics/marketing.ts` — `fetchMarketingData()`, `checkMarketingAlert()` — CPL 7d vs baseline 30d, tasa de confirmación
- [x] `app/actions/marketing.ts` — `logAdSpend`, `deleteAdSpend` — registro y borrado de gasto publicitario
- [x] `app/(dashboard)/analytics/marketing/page.tsx` — 4 KPI cards, banner de alerta roja (CPL > baseline×1.3 o confirmación < 20%), CSS bar chart 30d de gasto, formulario de registro, tabla historial con delete, historial de alertas
- [x] `app/api/internal/marketing-alerts/route.ts` — CRON diario: verifica CPL y confirmación, envía alerta WA al owner si supera umbral

**Sprint P3.4 — Bitácora / Trazabilidad ✅ (2026-05-16)**
- [x] `app/(dashboard)/activity/page.tsx` — Server Component, historial 30d de eventos fusionados (citas + tareas IA + recordatorios), agrupados por día con badges de color
- [x] Badge teal = recordatorio enviado, violet = tarea IA copilot, green/red/amber = eventos de cita (completada/cancelada/confirmada)
- [x] Links directos a `/appointments/[id]` y `/copilot/tasks/[id]` desde cada evento
- [x] Entrada "Bitácora" en nav bajo el grupo Copiloto IA — `components/nav-header.tsx`

**Sprint 6 — Expediente Operativo + Fixes ✅ (2026-05-19)**
- [x] `patients.contraindications TEXT` — campo dedicado en formulario, display ⚠ rojo en ficha si existe
- [x] Tabla `patient_photos` — fotos antes/después/general por paciente. Galería con lightbox, subida a Supabase Storage `patient-photos/clinic-photos/`. `components/patient/patient-photos.tsx`
- [x] Timeline de citas en ficha: muestra nombre del profesional con color dot y notas expandidas (sin truncar)
- [x] Página `/patients/[id]/consent` — consentimiento informado imprimible, pre-llenado con datos del paciente y clínica, botón "Imprimir / Guardar PDF"
- [x] `checkScheduleBlock()` en `app/actions/appointments.ts` — valida bloqueos de fecha Y horarios regulares del profesional al crear/editar cita. Error descriptivo si fuera de rango o día no laborable
- [x] `addDoctorSchedule` fix: incluía `is_active:true` + `doctor_name` (columna NOT NULL sin default)
- [x] Vista semanal de horarios siempre visible (antes oculta si `byPro` vacío)
- [x] `copilot_tasks.interaction_id` nullable + columna `source` — fix crítico que impedía la creación de todas las tareas automáticas
- [x] Staff text → copilot_task con link de cita pre-llenado (`lib/voice/parse-staff-text.ts`, Gemini)
- [x] Login page `force-dynamic` + mounted skeleton (fix Cloudflare Bot Fight Mode)

---

### Fase 6 — IA Avanzada (en curso)

**Sprint 6.1 — Cross-selling Inteligente ✅ (2026-05-14)**
- [x] NLU ampliado con intent `multi_service_interest`
- [x] TASK_CONFIG: copilot_task "Oportunidad cross-selling" prioridad medium

**Sprint 6.2 — Voice-to-Task para Staff ✅ (2026-05-15)**

El staff graba una nota de voz en WhatsApp desde su número registrado y el sistema la procesa automáticamente.

**Flujo propuesto:**
1. El médico envía un voice note al número de WhatsApp de la clínica desde un número autorizado (staff registrado)
2. El webhook detecta que el remitente es staff (no paciente) por el número
3. Gemini transcribe el audio (`generateContent` con base64 de media)
4. La IA extrae: paciente, acción, fecha/hora, mensaje a enviar al paciente
5. Sistema crea copilot_task, agenda cita si aplica, envía mensaje de guía al paciente por WhatsApp
6. Confirmación al médico: *"Entendido. Agendé control para Alessandra el 28/05 a las 10am y le envié la guía de cuidados"*

**Componentes técnicos:**
- `lib/whatsapp/extract.ts` → detectar `media_type: 'audio'` en el payload
- `lib/voice/transcribe.ts` → descarga audio de Meta Cloud API → base64 → Gemini `gemini-2.0-flash` con `inlineData`
- `lib/voice/parse-task.ts` → Gemini extrae entidades (paciente, acción, fecha)
- Staff autorizados: query a `org_members` por número de teléfono del remitente
- `app/api/whatsapp/webhook/route.ts` → routing: si mensaje es audio Y remitente es staff → `handleStaffVoiceNote()`

**Dependencias:**
- Gemini soporta audio MP3/OGG/WAV via `inlineData` en `gemini-2.0-flash`
- Meta Cloud API devuelve URL de media con token — necesita descarga con el access token de la clínica

**Sprint 6.3 — Predictor de Abandono por Sentimiento ✅ (2026-05-14)**
- [x] Score abandono 0-100 en `patients.abandonment_risk`
- [x] CRON semanal analiza últimos 10 mensajes por Gemini
- [x] copilot_task si score ≥ 65

**Sprint 6.5 — Plan Gating Completo + Sprint 1 ✅ (2026-05-16)**
- [x] `/backfill` gateado con `reactivation` (Pro+) — lock screen con CTA a pricing
- [x] `/opportunities` gateado con `roi_dashboard` (Premium) — lock screen con CTA a pricing
- [x] CSV Export: endpoints ya existían, botones verificados en `/patients` y `/leads`
- [x] Web Forms embed: `/settings/webforms` ya existe con snippet y gate `web_forms` (Pro+)
- [x] Documentación actualizada: CLAUDE.md, solucion_pacienteia.md

**Sprint 6.6 — API Pública + Onboarding Diferenciado ✅ (2026-05-16)**

- [x] Tabla `api_keys`: id, organization_id, name, key_hash (SHA-256), key_prefix (12 chars), created_by, last_used_at, revoked_at, created_at — `supabase/migrations/20260516000001_api_keys.sql`
- [x] `lib/api/keys.ts` — `generateApiKey()` genera `paia_` + 32 bytes base64url; `validateApiKey()` valida por hash
- [x] `app/actions/api-keys.ts` — `createApiKey`, `revokeApiKey` scoped a org del usuario
- [x] `app/(dashboard)/settings/api-keys/page.tsx` — listar keys, crear (raw key visible una sola vez via `?new_key=`), revocar, docs inline. Gate `api_webhooks` (Premium)
- [x] `app/api/v1/patients/route.ts` — GET lista pacientes, auth `X-API-Key`, soporta `?q` y `?limit`
- [x] `app/api/v1/appointments/route.ts` — GET lista citas, soporta `?date`, `?status`, `?limit`
- [x] `app/api/v1/leads/route.ts` — POST crea intake con `source_channel: 'api'`, SLA 30min
- [x] `middleware.ts` — bypass para `/api/v1/` (auth via API key, no sesión)
- [x] Nav de Configuración actualizado con "API Keys"
- [x] Onboarding: rubro en `?industry=` en todos los redirects entre steps; Step 4 personalizado por rubro (estética / dental / psicología / medicina)
- [x] Landing modal "Prueba Gratis": CTA secundario "Registrarme directamente →" → `https://app.pacienteia.com/signup?industry={rubro}`

**Sprint 6.4 — Omnicanalidad: Messenger + Instagram + TikTok ✅ (2026-05-15)**
- [x] Webhook Meta `/api/facebook/webhook` para DMs de Messenger e Instagram
- [x] Lead Ads de Facebook → pipeline via webhook `leadgen`
- [x] TikTok Lead Gen → pipeline via `/api/intake/tiktok`
- [x] Badge de canal en conversación e inbox
- [x] Reply desde PacienteIA en todos los canales
- [x] OAuth por clínica, `social_connections`, panel `/platform/social`
- [x] Paxi atiende prospectos por Messenger e Instagram de la página propia de PacienteIA

**Sprint P2.4 — Calendario drag & drop ✅ (2026-05-16)**
- [x] `dragRescheduleAppointment(id, newScheduledAt)` en `app/actions/appointments.ts` — actualiza `scheduled_at`, revalida `/calendar`
- [x] `WeeklyCalendar.tsx` — drag & drop HTML5 nativo: ghost azul con hora exacta, offset compensado, cursor grab/grabbing
- [x] `DayCalendar.tsx` — mismo drag & drop entre columnas de profesionales
- [x] Sin nuevas dependencias ni migración — usa `scheduled_at` existente

---

### Fase 7 — Innovación Disruptiva (meses 6-12)

| # | Feature | Mes estimado |
|---|---------|-------------|
| Voice-to-Clinical Record | Doctor graba audio → SOAP → ficha del paciente | Mes 6-7 |
| ~~Concierge de Sala de Espera~~ | ✅ `/waiting-room` + QR de autoregistro (`waiting_queue`) | Hecho |
| Auditor de Insumos por Foto | Foto vial vacío → stock automático → alerta proveedor | Mes 8-9 |
| Google Business API completa | Reseñas nuevas → sugerencia de respuesta IA — infra lista, solo config env | Mes 6 |
| Multi-especialidad con Derivación | Cross-selling clínico con plan integral | Mes 9-10 |
| Dynamic Pricing / Flash Sale IA | Precio diferencial en horas muertas | Mes 10 |
| Voice AI Receptionist 24/7 | Llamadas automáticas a hot leads | Mes 10-12 |
| App Móvil para Staff | Push notifications, agenda desde celular | Mes 12+ |

---

## 7. Pendientes Operativos (acciones del cliente — no técnicas)

| # | Tarea | Bloqueante para | Responsable |
|---|-------|----------------|------------|
| 1 | Token WhatsApp permanente (System User en Meta BM) | Automatizaciones WhatsApp en producción | Cliente |
| 2 | Activar n8n workflows (recordatorio 2h, encuesta, reactivación) | Flujos automáticos activos | Operaciones |
| 3 | Configurar Google Review URL en Ajustes → WhatsApp (La Rosa) | Escudo de reputación sin destino | Cliente |
| 4 | Configurar `retreatment_days` en servicios de La Rosa | Oportunidades de Revenue vacía | Cliente |
| 5 | Agregar `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` en Vercel | Google Business API | Operaciones |
| 6 | Meta App Review para Paxi (modo Live) | Paxi solo funciona con testers en modo Desarrollo | Cliente → Meta |
| 7 | Agregar `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET` + `FACEBOOK_WEBHOOK_VERIFY_TOKEN` en Vercel | Botón "Conectar" de Messenger/Instagram | Operaciones |
| 8 | Agregar callback URI en Meta App: `https://app.pacienteia.com/api/auth/facebook/callback` | OAuth de clínicas | Operaciones |
| 9 | Configurar webhook `/api/facebook/webhook` en Meta App → Messenger (suscribir `messages`, `leadgen`) | Recepción de DMs y Lead Ads | Operaciones |

> **Referencia:** `docs/manual-integraciones-sociales.md` tiene el paso a paso completo para #7, #8 y #9.

---

## 8. Matriz de Diferenciación Completa

| Capacidad | AgendaPro | Zenoti | PacienteIA actual | PacienteIA roadmap |
|-----------|-----------|--------|------------------|-------------------|
| Agenda + recordatorios WhatsApp | Parcial | No | ✅ | ✅ |
| WhatsApp nativo (no SMS) | Parcial | No | ✅ | ✅ |
| Clasificación de leads con IA | No | Parcial | ✅ | ✅ |
| Reactivación automática | No | Parcial | ✅ | ✅ |
| Escudo de reputación | No | No | ✅ | ✅ |
| Score de retención por paciente | No | No | ✅ | ✅ |
| NLU avanzado en conversaciones | No | No | ✅ | ✅ |
| Auto-agendamiento desde WhatsApp | No | No | ✅ | ✅ |
| Copiloto en conversaciones (sugerencias IA) | No | No | ✅ | ✅ |
| Backfill inteligente de slots | No | No | ✅ | ✅ |
| Oportunidades de revenue | No | No | ✅ | ✅ |
| Pago de reserva Yape/Plin + Niubiz | No | No | ✅ | ✅ |
| Flash offers para huecos | No | No | ✅ | ✅ |
| Predictor de abandono por sentimiento | No | No | ✅ | ✅ |
| Facebook Messenger en inbox | No | No | ✅ | ✅ |
| Instagram DMs en inbox | No | No | ✅ | ✅ |
| Lead Ads Facebook → pipeline automático | No | No | ✅ | ✅ |
| TikTok Lead Gen → pipeline automático | No | No | ✅ | ✅ |
| Voice-to-Task para staff (WhatsApp voice notes) | No | No | ✅ (Pro) | ✅ |
| API pública (REST endpoints + API keys) | No | No | ✅ (Premium) | ✅ |
| Voice-to-Clinical Record (SOAP automático) | No | Parcial (US) | No | Fase 7 |
| Analizador de fugas de marketing | No | No | ✅ (Pro) | ✅ |
| Auditor de insumos por foto | No | No | No | Fase 7 |
| Voice AI Receptionist 24/7 | No | ✅ | No | Fase 7 |
| Calendario visual (drag & drop) | Sí | Sí | ✅ | ✅ |
| Expediente operativo (contraindicaciones, fotos antes/después, consentimiento) | No | No | ✅ | ✅ |
| Validación de horarios al agendar (bloqueos + jornada del profesional) | Parcial | Sí | ✅ | ✅ |
| Español peruano + contexto Lima | No | No | ✅ | ✅ |

---

## 9. Modelo de Negocio Sugerido

### Planes

| Plan | Precio/mes | Qué incluye |
|------|-----------|-------------|
| **Básico** | S/ 99 | WhatsApp, confirmación de citas, recordatorios automáticos, escudo reputación |
| **Pro** | S/ 249 | + Reactivación, NLU avanzado, sugerencias IA, score de retención, oportunidades de revenue |
| **Premium** | S/ 499 | + Backfill inteligente, flash offers, reporte ROI automático, Google Business, pago de reserva |

### Implementación

- Implementación única: S/ 800 - S/ 1,500 según canales y volumen
- Comisión opcional: S/ 20-50 por paciente recuperado

### Proyección realista a 12 meses

| Segmento | Clientes | Ingreso mensual |
|---------|---------|----------------|
| 15 clientes Básico | S/ 99/mes | S/ 1,485 |
| 15 clientes Pro | S/ 249/mes | S/ 3,735 |
| 8 clientes Premium | S/ 499/mes | S/ 3,992 |
| **Total: 38 clientes** | | **S/ 9,212/mes ≈ USD 2,500/mes** |

---

## 10. Especialidades y Sus Restricciones

| Especialidad | Restricción | Features especiales a priorizar |
|-------------|-------------|-------------------------------|
| Clínicas estéticas | Sin consejo médico | Ciclos retratamiento (Botox 3m, rellenos 6m), flash offers estacionales |
| Odontología | Sin diagnósticos | Planes multi-sesión, tracking progreso tratamiento |
| Psicología | NUNCA revelar motivo de consulta — máxima privacidad | Mensajes neutros, sin mencionar especialidad en automáticos |
| Consultorios médicos | Sin diagnósticos | Solo gestión operativa, derivación entre especialistas |
| Centros de nutrición | Sin consejo dietético clínico | Ciclos de control mensual, tracking de adherencia |

---

---

## 11. Documentación Técnica Complementaria

| Documento | Contenido |
|-----------|-----------|
| `CLAUDE.md` | Arquitectura técnica, stack, reglas de código, mapa de archivos, estado del proyecto |
| `docs/guia-usuario.md` | Manual de uso para el staff de clínica (sin tecnicismos) |
| `docs/manual-integraciones-sociales.md` | Paso a paso de configuración: WhatsApp, Facebook, Instagram, TikTok |
| `DESIGN.md` | Design system, tokens de color, tipografía, patrones de componentes |

---

*Documento actualizado al 2026-06-12 (rev 8). Actualizar en cada sesión de desarrollo junto con CLAUDE.md.*
