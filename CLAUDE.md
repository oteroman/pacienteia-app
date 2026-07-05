# PacienteIA — Orquestador de Agentes

## LEER PRIMERO — Contexto esencial

PacienteIA es un SaaS B2B para clínicas en Lima, Perú. Automatiza operaciones vía WhatsApp: captación de leads, confirmación de citas, recordatorios, bandeja de mensajes unificada, y análisis operativo. **No es un sistema clínico — es un gerente de operaciones con IA.**

**La Regla de Hierro (no negociable):** La IA NUNCA da diagnósticos, prescripciones, ni consejos de salud. Solo gestiona operaciones: citas, mensajes, recordatorios, leads. Cualquier feature que viole esto se rechaza.

**Antes de construir cualquier feature:** Lee `memory/product_vision.md` y `memory/product_roadmap.md`.

**Estado actual:** Lee `memory/project_status.md` — tiene el último estado, qué está hecho, y el próximo paso.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19, Server Components + Server Actions)
- **DB:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth (email/password + invite)
- **Estilos:** Tailwind CSS — clase `brand-*` como color primario
- **IA:** Google Gemini (via `lib/copilot/`) — clasificación de intakes, tareas, respuestas sugeridas
- **Automatizaciones:** n8n (webhook_queue → n8n → acciones)
- **WhatsApp:** Meta Cloud API (webhook → `app/api/whatsapp/webhook/route.ts`)
- **Deploy:** Vercel (`npx vercel --prod`)
- **Lenguaje:** TypeScript estricto, español en UI, inglés en código

---

## Arquitectura Multi-Tenant

```
Organization (clínica / consultorio)
  └── Branch (sucursal)
        ├── org_members      (staff: owner / admin / staff)
        ├── professionals    (doctores / terapeutas — entidad propia)
        ├── services         (catálogo de tratamientos con precio base)
        ├── doctor_schedules (disponibilidad semanal por profesional)
        ├── schedule_blocks  (bloqueos de fecha — feriados, vacaciones)
        ├── patients         → contraindications TEXT
        ├── patient_photos   (fotos antes/después por paciente)
        ├── appointments     → professional_id FK
        ├── conversations    (hilos WhatsApp)
        └── intakes          (leads / entradas del funnel)
```

- Cookie `active_organization_id` + `active_branch_id` definen el contexto activo
- RLS usa `is_org_member(organization_id)` para aislar datos entre orgs
- Admin client (`lib/supabase/admin.ts`) bypassa RLS — usar **solo** en Server Actions y webhooks, NUNCA en Server Components directos
- User client (`lib/supabase/server.ts`) respeta RLS — usar para queries del dashboard

---

## Reglas de Código

### Patrones obligatorios
- Server Components para fetching de datos — no `useEffect` para cargar datos
- Server Actions en `app/actions/` para mutaciones — `'use server'` al tope del archivo
- Client Components solo cuando hay interactividad real (`'use client'`)
- Supabase queries con `(sb as any)` cuando las tablas no están en `types/database.ts`
- **NUNCA llamar `revalidatePath` desde un Server Action que se ejecuta durante el render de un Server Component** — solo desde form actions o route handlers

### Multi-tenant en queries
```typescript
// SIEMPRE filtrar por organization_id y/o branch_id
const { data } = await (sb as any)
  .from('appointments')
  .select('...')
  .eq('organization_id', organizationId)  // ← obligatorio
  .eq('branch_id', branchId)             // ← cuando aplique
```

### Server Actions — forma correcta
```typescript
'use server'
import { revalidatePath } from 'next/cache'

export async function myAction(formData: FormData): Promise<void> {
  // 1. getActiveContext() → organizationId, branchId
  // 2. Mutación con createAdminClient()
  // 3. revalidatePath(...)
  // 4. redirect(...) si aplica
}
```

### Migraciones Supabase
PowerShell Invoke-RestMethod cuelga — usar Node.js HTTPS directamente:
```bash
node -e "
const https = require('https');
const fs = require('fs');
const sql = fs.readFileSync('supabase/migrations/XXXX.sql', 'utf8');
const body = JSON.stringify({ query: sql });
const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/hwuuuslpzxcgpfzdjrhz/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer PAT_AQUI',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};
const req = https.request(options, res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => console.log(res.statusCode, d));
});
req.write(body); req.end();
"
```
PAT y project ID en `memory/supabase_credentials.md`.

### Deploy
```bash
npx vercel --prod
```

---

## Mapa de Archivos Clave

### Tenant / Auth
| Archivo | Propósito |
|---------|-----------|
| `lib/tenant/context.ts` | `getActiveContext()`, `getActiveOrganizationId()`, `getActiveBranchId()` |
| `lib/supabase/server.ts` | `createClient()` — user session + RLS |
| `lib/supabase/admin.ts` | `createAdminClient()` — bypassa RLS |
| `middleware.ts` | Protección de rutas, redirección a /login |

### Dashboard / Home
| Archivo | Propósito |
|---------|-----------|
| `app/(dashboard)/dashboard/page.tsx` | Home operacional: KPIs del día, agenda, alertas, WhatsApp sin leer, reactivaciones |

### WhatsApp Inbox
| Archivo | Propósito |
|---------|-----------|
| `app/api/whatsapp/webhook/route.ts` | Webhook Meta → valida HMAC → guarda en conversations + webhook_queue |
| `lib/whatsapp/extract.ts` | `extractInboundMessage()` — parsea payload de Meta |
| `lib/whatsapp/send.ts` | `sendWhatsAppText()` — envía mensaje via Cloud API |
| `lib/whatsapp/reminders.ts` | Message builders para recordatorios 24h / 2h |
| `lib/whatsapp/reminder-reply.ts` | Reply handler: "1" → confirmar, "2" → reagendar |
| `lib/whatsapp/followups.ts` | Message builders para encuesta post-cita |
| `lib/whatsapp/followup-reply.ts` | Reply handler: rating 1-5 → routing (Google Reviews vs alerta interna) |
| `lib/whatsapp/reactivation-messages.ts` | Builders paso 1 (warm) y paso 2 (follow-up 7 días) |
| `lib/whatsapp/reactivation-reply.ts` | Detecta "sí/claro/dale" → marca respondido + crea tarea copilot |
| `lib/inbox/conversations.ts` | `fetchConversations`, `fetchConversation`, `fetchConversationMessages` |
| `app/actions/conversations.ts` | `sendMessage`, `resolveConversation`, `markConversationRead`, `assignConversationToMe` |
| `app/(dashboard)/inbox/page.tsx` | Bandeja unificada (WhatsApp + intakes) |
| `app/(dashboard)/inbox/conversations/[id]/page.tsx` | Hilo de conversación individual |

### Leads / Intakes
| Archivo | Propósito |
|---------|-----------|
| `lib/intake/index.ts` | Tipos, labels, `fetchInbox`, `fetchIntake`, `fetchRecentResolved` |
| `lib/intake/orchestrate.ts` | `getSlaStatus`, `computeSlaDue`, lógica de escalación |
| `lib/intake/normalize.ts` | Gemini → normaliza mensaje, detecta intención y prioridad |
| `app/actions/intake.ts` | `processIntake`, `markInProgress`, `resolveIntake`, `dismissIntake`, etc. |
| `app/actions/leads.ts` | `createManualLead`, `convertLeadToPatient`, `scheduleLeadAppointment`, `markLeadInProgress`, `markLeadResolved`, `addLeadNote` |
| `app/(dashboard)/leads/page.tsx` | Lista con filtros por estado de pipeline |
| `app/(dashboard)/leads/[id]/page.tsx` | Detalle: info, pipeline stepper, acciones, timeline de eventos |

### Pacientes / Citas
| Archivo | Propósito |
|---------|-----------|
| `lib/validations/patient.ts` | Zod schema para pacientes (incluye `contraindications`) |
| `lib/validations/appointment.ts` | Zod schema para citas (incluye `professional_id`) |
| `app/actions/patients.ts` | `createPatient`, `updatePatient`, `softDeletePatient`, `addPatientPhoto`, `deletePatientPhoto` |
| `app/actions/appointments.ts` | `createAppointment`, `updateAppointment`, `updateAppointmentStatus`, `saveAppointmentNotes`, `cancelAppointment` — valida horarios y bloqueos del profesional |
| `app/(dashboard)/patients/` | CRUD pacientes |
| `app/(dashboard)/patients/[id]/page.tsx` | Ficha 360: contacto, contraindicaciones (⚠ rojo), fotos antes/después, timeline con profesional y notas, campañas, copilot tasks |
| `app/(dashboard)/patients/[id]/consent/page.tsx` | Documento de consentimiento informado imprimible — pre-llenado con datos del paciente y clínica. Botón "Imprimir / PDF" |
| `components/patient/patient-photos.tsx` | Galería fotos antes/después: upload, lightbox, eliminar. Bucket `patient-photos/clinic-photos/` |
| `app/(dashboard)/appointments/` | CRUD citas (new, [id], [id]/edit) |
| `components/appointment/appointment-form.tsx` | Form con combobox de servicios, dropdown de profesionales |

### Profesionales / Horarios / Servicios
| Archivo | Propósito |
|---------|-----------|
| `app/actions/professionals.ts` | `createProfessional`, `toggleProfessionalActive`, `deleteProfessional` |
| `app/(dashboard)/settings/professionals/page.tsx` | CRUD profesionales con color picker |
| `app/actions/schedules.ts` | `addDoctorSchedule`, `deleteDoctorSchedule`, `addScheduleBlock`, `deleteScheduleBlock` |
| `app/(dashboard)/settings/schedules/page.tsx` | Horarios semanales por profesional + bloqueos de fecha |
| `app/actions/services.ts` | `createService`, `toggleServiceActive`, `deleteService` |
| `app/(dashboard)/settings/services/page.tsx` | Catálogo de tratamientos con precio base y duración |

### Staff
| Archivo | Propósito |
|---------|-----------|
| `app/actions/staff.ts` | `inviteStaffMember`, `updateStaffRole`, `removeStaffMember` |
| `app/(dashboard)/settings/staff/page.tsx` | Lista de miembros + invitación por email |

### Recordatorios / Post-cita / Reactivación
| Archivo | Propósito |
|---------|-----------|
| `app/api/internal/appointment-reminders/route.ts` | CRON: recordatorios 24h y 2h antes de cita |
| `app/api/internal/appointment-followups/route.ts` | CRON: encuesta post-cita 4-10h después de atención |
| `app/api/internal/reactivation/route.ts` | CRON: paso 1 (warm) y paso 2 (follow-up 7d) para inactivos |

### Analytics
| Archivo | Propósito |
|---------|-----------|
| `lib/analytics/signals.ts` | Señales de churn / renewal |
| `lib/analytics/reminders.ts` | Stats de recordatorios, confirmaciones, no-shows |
| `lib/analytics/reputation.ts` | NPS, ratings, escudo de reputación |
| `app/(dashboard)/analytics/page.tsx` | Dashboard principal: funnel + eficiencia + período selector |
| `app/(dashboard)/analytics/reminders/page.tsx` | Métricas de recordatorios |
| `app/(dashboard)/analytics/reputation/page.tsx` | NPS + reseñas Google |
| `app/(dashboard)/analytics/reactivation/page.tsx` | Embudo de reactivación |
| `app/(dashboard)/analytics/revenue/page.tsx` | Revenue e ingresos |
| `app/(dashboard)/analytics/growth/page.tsx` | Evolución mensual 3/6/12 meses — para que el dueño vea el valor acumulado |
| `lib/analytics/marketing.ts` | `fetchMarketingData`, `checkMarketingAlert` — CPL, conversión, ad_spend KPIs |
| `app/actions/marketing.ts` | `logAdSpend`, `deleteAdSpend` — mutaciones de inversión publicitaria |
| `app/(dashboard)/analytics/marketing/page.tsx` | Analizador de Fugas de Marketing — KPIs, alerta banner, tabla gasto, historial alertas |
| `app/api/internal/marketing-alerts/route.ts` | CRON: verifica CPL y confirmación diariamente, alerta al dueño por WA |
| `app/(dashboard)/activity/page.tsx` | Bitácora — historial 30d de eventos de citas + tareas IA + recordatorios, agrupados por día |

### Copiloto IA
| Archivo | Propósito |
|---------|-----------|
| `lib/copilot/process.ts` | Gemini → extrae tareas de texto libre |
| `lib/copilot/index.ts` | `fetchTasks`, `createTask` |
| `app/(dashboard)/copilot/` | UI del copiloto: lista de tareas, detalle, nueva tarea |

### Redes Sociales (Facebook / Instagram / TikTok)
| Archivo | Propósito |
|---------|-----------|
| `app/(dashboard)/settings/social/page.tsx` | UI para que la clínica conecte su Página de Facebook + Instagram |
| `app/api/auth/facebook/route.ts` | Inicia el OAuth flow de Facebook (client side) |
| `app/api/auth/facebook/callback/route.ts` | Callback OAuth → guarda token en `social_connections` |
| `app/api/auth/facebook/platform/route.ts` | Inicia OAuth para la página propia de PacienteIA (Paxi) |
| `app/api/auth/facebook/platform/callback/route.ts` | Callback → guarda en `platform_social_config` |
| `app/api/facebook/webhook/route.ts` | Recibe eventos de Meta (Messenger DMs, Instagram DMs, Lead Ads) |
| `app/api/intake/tiktok/route.ts` | Recibe leads de TikTok Lead Gen via webhook |
| `lib/social/send.ts` | `sendFacebookMessage`, `sendInstagramMessage` desde el inbox |
| `app/actions/social.ts` | `disconnectSocial` — desconecta una red social de la org |
| `app/platform/social/page.tsx` | Panel de monitoreo de conexiones sociales (superadmin) |
| `lib/platform/sales-send-social.ts` | `sendPaxiFacebook`, `sendPaxiInstagram` para el bot Paxi |
| `docs/manual-integraciones-sociales.md` | Manual completo de configuración WhatsApp + Messenger + Instagram + TikTok |

### API Pública (Premium)
| Archivo | Propósito |
|---------|-----------|
| `lib/api/keys.ts` | `generateApiKey()`, `validateApiKey()` — SHA-256 hash, prefijo `paia_` |
| `app/actions/api-keys.ts` | `createApiKey`, `revokeApiKey` — scoped a org del usuario |
| `app/(dashboard)/settings/api-keys/page.tsx` | UI: listar keys, crear, revocar, docs inline. Gate `api_webhooks` (Premium). |
| `app/api/v1/patients/route.ts` | GET — lista pacientes. Auth: `X-API-Key` header |
| `app/api/v1/appointments/route.ts` | GET — lista citas. Soporta `?date`, `?status`, `?limit` |
| `app/api/v1/leads/route.ts` | POST — crea intake con `source_channel: 'api'` |

### Plataforma (superadmin)
| Archivo | Propósito |
|---------|-----------|
| `lib/platform/tenants.ts` | Gestión de organizaciones desde superadmin |
| `app/platform/page.tsx` | Panel de superadmin (home) |
| `app/platform/mrr/page.tsx` | Revenue & Growth — MRR, activación y oportunidades en tiempo real |
| `app/platform/trials/page.tsx` | Trials — seguimiento de cuentas en período de prueba |
| `app/platform/audit/page.tsx` | Auditoría — todas las acciones de admins de plataforma |
| `app/platform/crm/page.tsx` | CRM comercial — prospectos asignados y clientes captados |
| `app/platform/admins/page.tsx` | Equipo de Plataforma — miembros con rol superadmin/support/sales |
| `app/platform/health/page.tsx` | Health check de la plataforma |
| `app/actions/platform-admins.ts` | Gestión de miembros del equipo de plataforma |

### Operación Avanzada (Rebooking / Sala de Espera / Ops / Renewal / Value)
| Archivo | Propósito |
|---------|-----------|
| `app/(dashboard)/rebooking/page.tsx` | Recuperación de cancelaciones, no-shows y silencios. `fetchRebookingDashboard` (cancelled, noResponse, slotsFreed, resolvedToday) |
| `lib/rebooking/index.ts` | Lógica del dashboard de rebooking |
| `app/actions/rebooking.ts` | Acciones de recuperación (contactar, marcar resuelto) |
| `app/(dashboard)/waiting-room/page.tsx` | Concierge de Sala de Espera — cola en vivo (`waiting_queue`), posición, estados waiting/called |
| `app/(dashboard)/settings/waiting-room/page.tsx` | Config: QR imprimible para que el paciente se una a la cola |
| `app/actions/waiting-room.ts` | Acciones de la cola (llamar paciente, marcar atendido) |
| `app/(dashboard)/ops/page.tsx` | Operaciones — vista cross-sistema intake → inbox → copiloto → resolución (escalaciones, follow-ups, eventos) |
| `app/(dashboard)/renewal/page.tsx` | Señales de renovación/expansión cross-org (**solo platform admins**). `fetchRenewalSignals` en `lib/analytics/signals.ts` |
| `app/(dashboard)/value/page.tsx` + `app/(dashboard)/analytics/value/page.tsx` | Valor generado / ROI estimado con metodología conservadora (mercado Lima) |
| `app/(dashboard)/analytics/health/page.tsx` | Customer Health |
| `app/(dashboard)/analytics/playbook/page.tsx` | Playbook operativo — guía de acciones recomendadas |

---

## Tablas Supabase

| Tabla | Descripción |
|-------|-------------|
| `organizations` | Clínicas / consultorios |
| `branches` | Sucursales |
| `org_members` | Staff con roles (owner, admin, staff) |
| `professionals` | Doctores/terapeutas por branch — FK en appointments y doctor_schedules |
| `services` | Catálogo de tratamientos (nombre, precio, duración) |
| `doctor_schedules` | Disponibilidad semanal por profesional (`professional_id` FK) |
| `schedule_blocks` | Bloqueos de fecha (feriados, vacaciones, reuniones) |
| `patients` | Pacientes por org |
| `appointments` | Citas — `professional_id` FK a professionals |
| `appointment_reminders` | Tracking de recordatorios enviados (evita duplicados) |
| `appointment_followups` | Encuestas post-cita y alertas de reputación |
| `conversations` | Hilos WhatsApp por branch |
| `messages` | Mensajes individuales (inbound/outbound) |
| `branch_whatsapp_config` | Config WhatsApp por branch (token cifrado, Google Review URL) |
| `webhook_queue` | Cola para n8n |
| `intakes` | Leads / entradas del funnel (source_channel, status, priority, SLA) |
| `intake_events` | Timeline de eventos por intake (historial de contacto) |
| `reactivation_campaigns` | Campañas de reactivación de pacientes inactivos |
| `copilot_tasks` | Tareas generadas por IA (urgent, open, done) |
| `message_templates` | Plantillas de respuesta rápida por branch |
| `flash_offers` | Ofertas de slot vacío enviadas a inactivos |
| `delay_warnings` | Registro de avisos de demora enviados (evita duplicados) |
| `automation_settings` | Toggle por automation_key por branch |
| `slot_openings` | Slots de backfill abiertos |
| `sales_prospects` | Prospectos del vendedor IA Paxi |
| `sales_messages` | Mensajes del flujo de ventas Paxi (inbound/outbound) |
| `google_business_connections` | OAuth tokens de Google Business por org |
| `google_review_events` | Reseñas importadas desde Google Business |
| `social_connections` | Conexiones de redes sociales por org (Facebook, Instagram) — token de página, page_id, instagram_account_id |
| `platform_social_config` | Config de la página propia de PacienteIA (Paxi) — token, page_id, ig_account_id |
| `api_keys` | API keys de integración por org — hash SHA-256, prefijo visible, `revoked_at` para revocar |
| `ad_spend` | Inversión publicitaria por org/branch/día (Facebook, Instagram, Google, TikTok) |
| `marketing_alerts` | Alertas CPL/conversión generadas por el CRON de fugas de marketing |
| `patient_photos` | Fotos antes/después por paciente — `type` (before/after/general), `appointment_id` opcional |
| `waiting_queue` | Cola de la sala de espera por branch — `position`, `status` (waiting/called), `entered_at`, `called_at` |

---

## Estado del Proyecto (2026-06-12)

### COMPLETADO ✅

| Módulo | Descripción |
|--------|-------------|
| F0 Base | Auth, multi-tenant, pacientes, citas, copiloto, webhook básico |
| F1.1 Inbox WhatsApp | Bandeja unificada, hilo de conversación, compositor de mensajes |
| F1.2 Recordatorios | 24h y 2h antes, reply handler (1=confirmar, 2=reagendar) |
| F1.3 Post-cita + Reputación | Encuesta automática 4h post-atención, routing por score, escudo Google Reviews |
| F2 Reactivación | Campaña 2 pasos para inactivos, reply handler, dashboard |
| Dashboard operacional | KPIs del día, agenda clicable, alertas, WhatsApp sin leer |
| Analytics F3 | Funnel leads→citas→completadas, eficiencia, período selector, sub-dashboards |
| Profesionales | Tabla `professionals` como entidad propia, color picker, vinculada a citas y horarios |
| Horarios | `doctor_schedules` y `schedule_blocks` vinculados a `professionals` |
| Servicios | Catálogo `services` con precio y duración, picker en formulario de citas |
| Leads Pipeline | Lista con filtros por estado, detalle con timeline, acciones de transición, notas |
| Staff | Invitación por email, roles (owner/admin/staff), quitar miembros |
| Score Retención | `retention_score` 0-100 en ficha + lista de pacientes, widget dashboard |
| Backfill Slots | Slot vacío → WA a candidatos inactivos, reply handler, UI manual `/backfill` |
| Oportunidades Revenue | Ciclo retratamiento por servicio, detección 14d, widget dashboard `/opportunities` |
| NLU Conversaciones | 10 intents, auto-respuestas, tareas copilot, filtros inbox, cross-selling |
| Auto-Agendamiento WA | Booking flow 2 pasos desde WhatsApp, `appointment_request` → cita directa |
| Sugerencias IA | Respuesta sugerida por Gemini en composer del hilo |
| Reagendamiento completo | Reminder "2" → slots → paciente elige → cita actualizada; escalación CRON |
| Google Business Rep. | OAuth por clínica, CRON reseñas nuevas, copilot_task con respuesta IA |
| Vendedor IA (Paxi) | Bot WhatsApp captación prospectos PacienteIA, pipeline `/platform/sales` |
| Multi-App WhatsApp | HMAC per-clínica, app_secret por branch, onboarding independiente |
| Plantillas respuesta | CRUD en Ajustes, picker en composer, categorías, activar/pausar |
| Flash Offers | Slots vacíos mañana → descuento a inactivos; reply handler crea cita |
| Reporte ROI semanal | WhatsApp al dueño cada lunes con 6 métricas clave |
| Smart Buffer | Detecta citas overrun → avisa siguiente paciente automáticamente |
| Cross-selling NLU | Intent `multi_service_interest` → tarea copilot de oportunidad |
| Predictor Abandono | Gemini analiza tono WA → score 0-100 → copilot_task si ≥ 65 |
| Ficha 360 Paciente | Vista cross-branch: retención, riesgo, tareas IA, WA, campañas, citas |
| Panel Automatizaciones | Toggle por flujo (8 keys) sin tocar n8n |
| Inbox mobile-first | Breakpoint `lg:` (1024px) — tablet/móvil ve un panel a la vez |
| Plantillas base seeded | 15 plantillas curadas (6 categorías) cargadas en La Rosa |
| Landing V3 | `pacienteia.com` — Next.js, logo inline SVG, CTA → Paxi WA |
| Design System | tokens brand/ai/lima/ink/mist/fog/slate en Tailwind + CSS vars |
| Analytics Crecimiento | `/analytics/growth` — selector 3/6/12 meses (default 3), barras CSS, tabla |
| Platform Roles | Roles superadmin/support/sales, nav filtrado por rol, CRM comerciales |
| Billing UI | `/billing` — uso del mes, features por plan, banners de upgrade/trial |
| Pricing page | `/pricing` — cards con features, precios S/99/249/499 alineados con landing |
| Redes Sociales | OAuth Facebook/Instagram por clínica, webhook Meta (DMs + Lead Ads), TikTok Lead Gen, inbox multi-canal, `/platform/social` para superadmin |
| Voice-to-Task Staff | Staff graba nota de voz en WA → Gemini transcribe → copilot_task creada. `org_members.whatsapp_phone` identifica al staff. `lib/voice/` |
| CSV Export | `/api/export/patients` y `/api/export/leads` con gate `csv_export` (Pro+). Botón en ambas páginas. |
| Web Forms embed | `/settings/webforms` con snippet HTML para pegar en la web. Gate `web_forms` (Pro+). |
| Plan gating completo | `/backfill` (reactivation/Pro+), `/opportunities` (roi_dashboard/Premium), `/analytics/reactivation`, `/analytics/revenue`, `/analytics/growth` gateados. |
| API Pública + Keys | `lib/api/keys.ts` genera y valida keys `paia_*`. `/settings/api-keys` (gate Premium). 3 endpoints: GET /api/v1/patients, GET /api/v1/appointments, POST /api/v1/leads. Tabla `api_keys`. |
| Onboarding diferenciado | Rubro se propaga como param URL + hidden inputs. Step 4 muestra features específicas por rubro (estética/dental/psicología/medicina). Landing: modal "Prueba Gratis" tiene CTA "Registrarme directamente" → `/signup?industry={rubro}`. |
| Calendario drag & drop | Vista semanal y diaria existentes. Drag & drop nativo HTML5 para reagendar: ghost slot con hora, offset compensado, actualiza DB al soltar. `dragRescheduleAppointment` en `app/actions/appointments.ts`. |
| Bitácora `/activity` | Historial 30d de eventos: citas (appointment_events), tareas IA (copilot_tasks), recordatorios enviados. Agrupado por día, badges por tipo, links a detalle. |
| Fugas de Marketing | `/analytics/marketing` — CPL 7d vs base 30d, tasa confirmación, gasto diario (CSS bars), formulario registro, alertas históricas. CRON `/api/internal/marketing-alerts`. Tablas `ad_spend` + `marketing_alerts`. |
| **Fixes sesión 2026-05-18** | Login page `force-dynamic` + skeleton (Cloudflare Bot Fight Mode fix). Middleware redirige `/` → `/login`. Staff page null-safe. Nav Staff movido a posición 2. copilot_tasks: `interaction_id` nullable + columna `source`. Tareas copilot newest-first. Fallback audio Meta test number. Staff text → copilot_task con link pre-llenado de cita (`lib/voice/parse-staff-text.ts`). Fecha+hora en form de citas. Teléfono solo numérico. |
| **Horarios y bloqueos** | Vista semanal siempre visible (estado vacío si no hay datos). Bloqueos de fecha y horarios regulares se respetan al crear/editar citas (`checkScheduleBlock` en `app/actions/appointments.ts`). Bug fix `is_active` y `doctor_name NOT NULL` en `addDoctorSchedule`. |
| **Expediente Operativo** | Tabla `patients.contraindications` (campo dedicado, se muestra en ⚠ rojo). Tabla `patient_photos` (fotos antes/después, galería con lightbox). Timeline de citas muestra profesional con color dot. Documento de consentimiento informado imprimible `/patients/[id]/consent`. |
| **Rebooking** | `/rebooking` — recuperación de cancelaciones, no-shows y silencios. `lib/rebooking/index.ts` + `app/actions/rebooking.ts`. Pill de pendientes en header. |
| **Concierge Sala de Espera** | `/waiting-room` cola en vivo (`waiting_queue`) con posición y estados waiting/called; `/settings/waiting-room` genera QR imprimible para autoregistro del paciente. `app/actions/waiting-room.ts`. |
| **Ops (cross-sistema)** | `/ops` — vista intake → inbox → copiloto → resolución: escalaciones, follow-ups pendientes, eventos recientes, performance de clínicas. |
| **Renewal Signals** | `/renewal` (**solo platform admins**) — señales cross-org de renovación/expansión/riesgo. `fetchRenewalSignals` en `lib/analytics/signals.ts`. |
| **Value / ROI** | `/value` y `/analytics/value` — valor generado y ROI estimado con metodología conservadora (Lima). `/analytics/health` (Customer Health) y `/analytics/playbook` (Playbook operativo). |
| **Platform consolas** | `/platform/mrr` (MRR & Growth tiempo real), `/platform/trials`, `/platform/audit` (auditoría de admins), `/platform/crm` (CRM comercial), `/platform/admins` (equipo de plataforma). |
| **Consolidación a git (2026-06-12)** | Casi todo el código vivía solo en el working tree y se desplegaba con `npx vercel --prod` directo desde local. Se versionó todo + se sacaron secretos hardcodeados del fuente (ver `memory/pending-credential-rotation.md`). |

### n8n WORKFLOWS (todos activos ✅)

| Workflow | ID | Cron (UTC) |
|----------|-----|------------|
| Recordatorio 24h | `Yp1PyCvHvMBuzySR` | `0 13 * * *` |
| Recordatorio 2h | `zrg6OeyKQDxsScpq` | Cada hora 7-15h Lima |
| Encuesta post-cita | `GQBK1dLS4PL6k5Yi` | `0 * * * *` |
| Reactivación paso 1 | `re29X6GI7IW9fooG` | L-V 15:00 UTC |
| Reactivación paso 2 | `h8gdAFoCKl1nT2Wy` | Lunes 15:00 UTC |
| Escalación reagend. | `nmja2HM4AjOyHVdx` | `0 * * * *` |
| Flash Offers | `LGMCgPKa4OqZaEmF` | `0 0 * * *` |
| Smart Buffer | `5gWJk4q6tMJzCHWK` | `*/30 12-23 * * *` |
| Reporte ROI | `1MxZWUhHGpr2zZ6Q` | `0 13 * * 1` |
| Predictor Abandono | `ITdkuHjDCdASLKBn` | `0 4 * * 1` |

**CRON interno Vercel** (no n8n): `/api/internal/marketing-alerts` — diario, autenticado con `x-cron-secret`.

**CRON_SECRET:** `<CRON_SECRET_ROTAR>`

### PENDIENTES OPERATIVOS (config, no código)

| # | Tarea | Quién |
|---|-------|-------|
| ~~1~~ | ~~Token WhatsApp permanente~~ | ✅ Token permanente confirmado. Demo usa número de prueba Meta. |
| 2 | Configurar Google Review URL en Ajustes → WhatsApp de La Rosa | Manuel |
| 3 | Configurar `retreatment_days` en servicios de La Rosa | Manuel |
| 4 | Agregar `GOOGLE_OAUTH_CLIENT_ID/SECRET` en Vercel + conectar La Rosa | Manuel |
| 5 | App Review Meta para Paxi (modo Live) | Manuel → Meta |
| 6 | Agregar `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_WEBHOOK_VERIFY_TOKEN` en Vercel (misma app que WA) | Manuel |
| 7 | Agregar `https://app.pacienteia.com/api/auth/facebook/callback` como Valid OAuth Redirect URI en Meta App | Manuel |
| 8 | Configurar webhook `/api/facebook/webhook` en Meta App → Messenger (para recibir DMs y leads) | Manuel |

**Manual de integración completo:** `docs/manual-integraciones-sociales.md`

---

## GAPS / SPRINT BACKLOG

Features que están comprometidas en planes pero no tienen código completo, ordenadas por impacto.

### Sprint 1 — ✅ COMPLETADO (2026-05-16)

| # | Feature | Estado |
|---|---------|--------|
| S1-1 | **CSV Export** | ✅ `/api/export/patients` + `/api/export/leads` con gate `csv_export`. Botón en ambas páginas. |
| S1-2 | **Web Forms embed** | ✅ `/settings/webforms` con snippet HTML embed. Gate `web_forms` (Pro+). |
| S1-3 | **Plan gating enforcement** | ✅ `/backfill` (Pro+), `/opportunities` (Premium), `/analytics/revenue` (Premium) gateados. |
| S1-4 | **Voice-to-Task Staff** | ✅ Nota de voz WA → Gemini transcribe → copilot_task. `lib/voice/`. |

### Sprint 2 — ✅ COMPLETADO (ya estaba hecho)

| # | Feature | Estado |
|---|---------|--------|
| S2-1 | **Multi-sucursal UI** | ✅ `/settings/branches` — CRUD completo, gate `multi_branch` (Premium), switch de sucursal activa |
| S2-2 | **Niubiz — generación de link de pago** | ✅ `lib/payments/niubiz.ts` + webhook `/api/webhooks/niubiz` — genera link, recibe confirmación, actualiza cita a `paid` + WA al paciente |

### Sprint 3 — ✅ COMPLETADO (2026-05-16)

| # | Feature | Estado |
|---|---------|--------|
| S3-1 | **API pública + API keys** | ✅ Tabla `api_keys`, `lib/api/keys.ts`, `/settings/api-keys` (gate Premium), 3 endpoints `/api/v1/`. |
| S3-2 | **Landing multi-rubro con onboarding diferenciado** | ✅ Rubro viaja como param URL + hidden inputs en cada step. Step 4 personalizado por rubro. Modal landing con CTA directo a `/signup?industry={rubro}`. |

### Sprint 4 — ✅ COMPLETADO (2026-05-16)

| # | Feature | Estado |
|---|---------|--------|
| ~~P2.4~~ | ~~**Calendario visual (drag & drop)**~~ | ✅ 2026-05-16 — Drag & drop HTML5 nativo en `WeeklyCalendar.tsx` y `DayCalendar.tsx`. Ghost azul con hora exacta, offset compensado, `dragRescheduleAppointment` en `app/actions/appointments.ts`. Sin nuevas dependencias ni migración. |

### Sprint 5 — ✅ COMPLETADO (2026-05-16)

| # | Feature | Estado |
|---|---------|--------|
| P3.4 | **Bitácora / Trazabilidad** | ✅ `/activity` — Server Component, 30d de eventos fusionados (citas + IA + recordatorios), agrupados por día con badges. Nav: Copiloto IA → Bitácora. |
| P3.2 | **Analizador de Fugas de Marketing** | ✅ `/analytics/marketing` — KPIs CPL/conversión, alert banner, CSS bar chart 30d, form registro gasto, historial alertas. CRON WA al dueño. Migración `20260516000002_marketing_analytics.sql`. |

### Sprint 6 — ✅ COMPLETADO (2026-05-19)

| # | Feature | Estado |
|---|---------|--------|
| S6-1 | **Expediente Operativo del Paciente** | ✅ Contraindicaciones/alergias en ficha (campo dedicado + display ⚠ rojo). Fotos antes/después (`patient_photos` table + galería con lightbox). Timeline mejorado con profesional + color. Consentimiento informado imprimible `/patients/[id]/consent`. |
| S6-2 | **Validación de horarios en citas** | ✅ `checkScheduleBlock()` valida bloqueos de fecha Y horarios regulares del profesional. Error descriptivo si fuera de rango. Aplica a crear y editar cita. |
| S6-3 | **Fixes críticos producción** | ✅ copilot_tasks `interaction_id` nullable + columna `source`. `addDoctorSchedule` incluye `is_active:true` y `doctor_name`. Vista semanal de horarios siempre visible. Staff text→copilot_task con link pre-llenado. Login force-dynamic + mounted skeleton. |

---

## Credenciales de Demo (La Rosa — juanramirez20932@gmail.com)

| Variable | Valor |
|----------|-------|
| Supabase Project | `hwuuuslpzxcgpfzdjrhz` |
| Organization ID | `860dee6e-612e-4673-87cc-1ccefd602f46` |
| Branch ID | `1e51d833-00b4-4233-acbb-44a55b0f62a1` |
| Phone Number ID (Meta) | `1169072966279649` |
| WABA ID | `1000106235772431` |
| Vercel project | `illari-labs/pacienteia-app` |
| URL producción | `https://app.pacienteia.com` |

Credenciales completas (keys, PAT, etc.) en `memory/supabase_credentials.md`.

---

## Guía para Multi-Agentes

### SDLC Agéntico (ecosistema propio del repo)
Roster de subagentes especializados en `.claude/agents/` + comandos en `.claude/commands/`. **Playbook completo: `docs/sdlc-agentico.md`.**

| Fase | Subagente | Comando |
|------|-----------|---------|
| Descubrimiento | `analista-producto` | `/feature <idea>` (orquesta todo) |
| Arquitectura | `arquitecto-plan` | |
| Datos | `db-migrator` | `/migracion <cambio>` |
| Backend | `backend-actions` | |
| Integraciones | `integraciones` | |
| UI | `frontend-clinico` | |
| Gate seguridad/tenant | `guardian-rls-seguridad` | `/revision` |
| Gate Regla de Hierro | `regla-de-hierro` | |
| Release | `release-manager` | `/release` |

Cada agente codifica los patrones reales de este repo (RLS, Server Actions, DESIGN.md, migraciones Node HTTPS, Regla de Hierro). Los dos gates de calidad son **solo lectura y obligatorios antes de release**.

### Subagentes genéricos de Claude Code
- **Explore**: para mapear archivos antes de una refactor grande
- **Plan**: para diseñar arquitectura de un feature nuevo antes de codear
- **general-purpose**: para búsquedas amplias en el codebase o research

### Workflow para un feature nuevo
1. Leer `memory/product_vision.md` + `memory/product_roadmap.md`
2. Revisar sección "Diferenciadores Disruptivos" arriba — ¿el feature ya existe parcialmente?
3. Implementar con Edit, Write, Bash
4. Migración si aplica: Node.js HTTPS (no PowerShell)
5. Deploy: `npx vercel --prod`
6. Actualizar `memory/project_status.md`

### Qué NO delegar a subagentes
- Decisiones de arquitectura que afecten RLS o multi-tenancy
- Commits y deploys — siempre confirmar con el usuario
- Cambios en variables de entorno de Vercel

---

## Especialidades y Sus Restricciones

| Especialidad | Restricción especial |
|--------------|---------------------|
| Clínicas estéticas | Sin consejo médico; solo operaciones |
| Odontología | Planes multi-sesión; tracking de sesiones |
| Psicología | NUNCA revelar motivo de consulta; máxima privacidad |
| Consultorios médicos | Sin diagnósticos; solo gestión operativa |
