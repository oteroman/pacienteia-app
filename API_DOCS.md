# PacienteIA — Documentación Técnica de API

**Base URL producción:** `https://app.pacienteia.com`

---

## 1. Endpoints Públicos / Semipúblicos

### POST /api/intake/webform

Captura leads desde formularios de contacto en el sitio web de la clínica. No requiere autenticación de usuario, pero sí un `clinic_id` válido.

**Autenticación:** Ninguna (público). Valida que `clinic_id` exista en la base de datos.

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clinic_id` | `string` (UUID) | Sí | ID de la organización en PacienteIA |
| `message` | `string` (min 3 chars) | Sí | Mensaje o consulta del prospecto |
| `contact_name` | `string` | No | Nombre del prospecto |
| `contact_phone` | `string` | No | Teléfono (formato libre) |
| `contact_email` | `string` | No | Email del prospecto |

**Respuestas:**

| Status | Body | Descripción |
|--------|------|-------------|
| `201` | `{ "id": "uuid" }` | Lead creado exitosamente |
| `400` | `{ "error": "missing_fields" }` | Falta `clinic_id` o `message` demasiado corto |
| `400` | `{ "error": "invalid_json" }` | Body no es JSON válido |
| `404` | `{ "error": "org_not_found" }` | `clinic_id` no existe |
| `422` | `{ "error": "branch_not_configured" }` | La org no tiene sucursales activas |
| `500` | `{ "error": "server_error" }` | Error interno |

**Ejemplo curl:**

```bash
curl -X POST https://app.pacienteia.com/api/intake/webform \
  -H "Content-Type: application/json" \
  -d '{
    "clinic_id": "860dee6e-612e-4673-87cc-1ccefd602f46",
    "contact_name": "María Torres",
    "contact_phone": "+51987654321",
    "message": "Quiero información sobre tratamiento de botox"
  }'
```

---

### POST /api/intake/tiktok

Recibe leads desde TikTok Lead Generation. Soporta el formato nativo de respuestas de formularios de TikTok. Deduplica por `lead_id`.

**Autenticación:** Ninguna (público). TikTok envía un handshake GET antes de activar el webhook.

**GET (handshake):** Responde el parámetro `?challenge=...` para verificación.

**Body POST (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clinic_id` | `string` (UUID) | Sí | ID de la organización |
| `lead_id` | `string` | No | ID externo de TikTok (para dedup) |
| `form_name` | `string` | No | Nombre del formulario de TikTok |
| `campaign_id` | `string` | No | ID de campaña publicitaria |
| `ad_id` | `string` | No | ID del anuncio |
| `answers` | `Array<{ field_name, value }>` | No | Respuestas del formulario |

**Campos reconocidos en `answers`:** `FULL_NAME`, `NAME`, `PHONE_NUMBER`, `PHONE`, `EMAIL`. Cualquier otro campo se agrega como texto libre al mensaje.

**Respuestas:**

| Status | Body | Descripción |
|--------|------|-------------|
| `201` | `{ "id": "uuid" }` | Lead creado |
| `200` | `{ "id": "uuid", "duplicate": true }` | Lead ya existía (dedup por `lead_id`) |
| `400` | `{ "error": "missing_clinic_id" }` | Falta `clinic_id` |
| `404` | `{ "error": "org_not_found" }` | Org no encontrada |
| `422` | `{ "error": "branch_not_configured" }` | Sin sucursales activas |

**Ejemplo curl:**

```bash
curl -X POST https://app.pacienteia.com/api/intake/tiktok \
  -H "Content-Type: application/json" \
  -d '{
    "clinic_id": "860dee6e-612e-4673-87cc-1ccefd602f46",
    "lead_id": "tt_lead_abc123",
    "form_name": "Consulta HIFU",
    "campaign_id": "123456",
    "answers": [
      { "field_name": "FULL_NAME",    "value": "Ana García" },
      { "field_name": "PHONE_NUMBER", "value": "+51912345678" },
      { "field_name": "CUSTOM_001",   "value": "Interesada en botox y relleno" }
    ]
  }'
```

---

### POST /api/webhooks/leads

Webhook genérico para integraciones externas (n8n, Zapier, CRMs). Acepta leads desde múltiples canales.

**Autenticación:** Header `x-webhook-secret` con el valor de `WEBHOOK_SECRET`. Requiere plan **Premium** (`api_webhooks`).

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clinic_id` o `org_id` | `string` | Sí | UUID o slug de la organización |
| `message` | `string` | Sí | Contenido del mensaje / consulta |
| `source` | `string` | No | Canal de origen (ver tabla abajo) |
| `phone` | `string` | No | Teléfono del prospecto |
| `name` | `string` | No | Nombre del prospecto |
| `email` | `string` | No | Email del prospecto |

**Valores válidos para `source`:**

| Valor | Canal mapeado |
|-------|---------------|
| `whatsapp` | WhatsApp (default) |
| `instagram` | Instagram |
| `facebook` | Facebook |
| `tiktok` | TikTok |
| `web` / `webform` | Formulario web |
| `call` | Llamada telefónica |
| `manual` | Ingreso manual |

**Respuestas:**

| Status | Body | Descripción |
|--------|------|-------------|
| `201` | `{ "id": "uuid" }` | Lead creado |
| `400` | `{ "error": "org_id and message are required" }` | Campos obligatorios faltantes |
| `401` | `{ "error": "unauthorized" }` | Secret incorrecto o ausente |
| `404` | `{ "error": "org_not_found" }` | Org no encontrada |
| `422` | `{ "error": "branch_not_configured" }` | Sin sucursales |
| `500` | `{ "error": "intake_failed" }` | Error interno |

**Ejemplo curl:**

```bash
curl -X POST https://app.pacienteia.com/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: TU_WEBHOOK_SECRET" \
  -d '{
    "clinic_id": "la-rosa-clinica",
    "source": "instagram",
    "name": "Carlos Pérez",
    "phone": "+51998765432",
    "message": "Hola, quiero info sobre limpieza facial"
  }'
```

---

### GET /api/export/patients

Exporta todos los pacientes activos de la organización como archivo CSV.

**Autenticación:** Sesión de usuario activa (cookie `sb-*`). Requiere plan **Pro** o superior (`csv_export`).

**Parámetros:** Ninguno. Usa el contexto activo (`active_organization_id` cookie).

**Respuesta exitosa (200):**

- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="pacientes_YYYY-MM-DD.csv"`
- Columnas: `Nombre, Teléfono, Email, DNI, Estado, Última visita, Score retención, Registrado`

**Errores:**

| Status | Body | Descripción |
|--------|------|-------------|
| `401` | `{ "error": "unauthorized" }` | Sin sesión |
| `403` | `{ "error": "plan_required" }` | Plan insuficiente (necesita Pro+) |
| `500` | `{ "error": "db_error" }` | Error de base de datos |

**Ejemplo curl (con cookie de sesión):**

```bash
curl -X GET https://app.pacienteia.com/api/export/patients \
  -H "Cookie: sb-hwuuuslpzxcgpfzdjrhz-auth-token=TU_TOKEN" \
  -o pacientes.csv
```

---

### GET /api/export/leads

Exporta todos los leads (intakes) de la organización como archivo CSV.

**Autenticación:** Sesión de usuario activa. Requiere plan **Pro** o superior (`csv_export`).

**Parámetros:** Ninguno. Usa el contexto activo (`active_organization_id` cookie).

**Respuesta exitosa (200):**

- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="leads_YYYY-MM-DD.csv"`
- Columnas: `Nombre, Teléfono, Email, Canal, Mensaje, Resumen IA, Prioridad, Estado, Intent, Recibido, Resuelto`

**Errores:** Iguales a `/api/export/patients`.

**Ejemplo curl:**

```bash
curl -X GET https://app.pacienteia.com/api/export/leads \
  -H "Cookie: sb-hwuuuslpzxcgpfzdjrhz-auth-token=TU_TOKEN" \
  -o leads.csv
```

---

## 2. Webhooks Outbound (PacienteIA → n8n)

PacienteIA dispara webhooks a n8n vía `lib/n8n/client.ts` cuando ocurren eventos de negocio. El destino es `N8N_WEBHOOK_BASE_URL/webhook/{event_type}`.

**Método:** `POST`  
**Content-Type:** `application/json`

### Estructura del payload

```typescript
{
  organization_id: string   // UUID de la organización
  event_type: string        // Ver tabla de eventos
  entity_type?: string      // Tipo de entidad ("appointment", "patient", etc.)
  entity_id?: string        // UUID de la entidad relacionada
  // ... campos adicionales según el evento
}
```

### Eventos disponibles

| `event_type` | URL n8n | Cuándo se dispara |
|--------------|---------|-------------------|
| `lead.created` | `/webhook/lead.created` | Nuevo intake procesado (webform, TikTok, WhatsApp, etc.) |
| `appointment.created` | `/webhook/appointment.created` | Nueva cita agendada |
| `appointment.upcoming` | `/webhook/appointment.upcoming` | CRON: cita próxima (24h o 2h antes) |
| `patient.inactive` | `/webhook/patient.inactive` | CRON: paciente sin cita en 90+ días |
| `post_treatment.followup` | `/webhook/post_treatment.followup` | CRON: 4-10h después de cita completada |

---

## 3. Plan Features

Definidos en `lib/plans/config.ts`. Los precios son en Soles peruanos (PEN) / mes.

| Feature | Descripción | Plan mínimo |
|---------|-------------|-------------|
| `reputation_shield` | Encuesta post-cita + nudge a Google Reviews | Trial |
| `advanced_confirmation` | Secuencia WhatsApp de 3 pasos para confirmar citas | Pro (S/ 249) |
| `lead_triage_ai` | Clasificación hot/warm/cold con Gemini | Pro (S/ 249) |
| `reactivation` | Campaña automática para pacientes inactivos +90 días | Pro (S/ 249) |
| `post_treatment_followup` | Seguimiento post-cita a los 3/7/30 días | Pro (S/ 249) |
| `web_forms` | Formularios embebibles de captura de leads | Pro (S/ 249) |
| `csv_export` | Exportación de pacientes y leads a CSV | Pro (S/ 249) |
| `roi_dashboard` | Dashboard de ROI: S/ recuperados, citas salvadas | Premium (S/ 499) |
| `api_webhooks` | API externa + webhooks entrantes | Premium (S/ 499) |
| `multi_branch` | Múltiples sucursales / ubicaciones | Premium (S/ 499) |

### Límites por plan

| Límite | Trial | Básico (S/99) | Pro (S/249) | Premium (S/499) |
|--------|-------|---------------|-------------|-----------------|
| Usuarios | 1 | 1 | 3 | Ilimitado |
| Leads/mes | 50 | 100 | 300 | Ilimitado |
| Citas/mes | 150 | 300 | 800 | Ilimitado |
| Flujos n8n | 1 | 2 | 5 | Ilimitado |

---

## 4. Variables de Entorno

### Requeridas (sin estas el sistema no arranca)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (pública) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase para el cliente browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase — bypassa RLS, solo server-side |
| `GEMINI_API_KEY` | API key de Google Gemini para clasificación de intakes, copiloto y NLU |

### WhatsApp

| Variable | Descripción |
|----------|-------------|
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación del webhook Meta Cloud API |
| `WHATSAPP_APP_SECRET` | App secret de Meta para validar HMAC de mensajes entrantes (fallback global) |
| `WHATSAPP_TOKEN_ENC_KEY` | Clave de cifrado AES para tokens de acceso WhatsApp almacenados en DB |

### Integraciones y automatización

| Variable | Descripción |
|----------|-------------|
| `N8N_WEBHOOK_BASE_URL` | URL base del servidor n8n (ej. `https://n8n.tudominio.com`) |
| `WEBHOOK_SECRET` | Secret compartido para autenticar webhooks entrantes en `/api/webhooks/*` |
| `CRON_SECRET` | Secret para autenticar llamadas de n8n/Vercel Cron a `/api/internal/*` |
| `ADMIN_DASHBOARD_SECRET` | Secret adicional para endpoints internos de automatización |

### Google Business (opcional)

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID de Google Cloud para OAuth de Google Business |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Client Secret de Google Cloud para OAuth de Google Business |

### Vendedor IA Paxi (opcional)

| Variable | Descripción |
|----------|-------------|
| `SALES_WHATSAPP_ACCESS_TOKEN` | Token de acceso WhatsApp del número de Paxi (bot de ventas) |
| `SALES_WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID del número de WhatsApp de Paxi |
| `SALES_WHATSAPP_APP_SECRET` | App secret de Meta para el webhook de Paxi |

### App y pagos

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | URL pública de la app (ej. `https://app.pacienteia.com`) |
| `NEXT_PUBLIC_SITE_URL` | URL del sitio para links en emails de invitación de staff |
| `NIUBIZ_ENV` | Entorno de pagos Niubiz: `sandbox` o `production` |
| `OPS_EMAIL` | Email de operaciones para alertas de salud del cliente |

### Opcionales

| Variable | Descripción |
|----------|-------------|
| `GEMINI_MODEL_NAME` | Nombre del modelo Gemini a usar (default: `gemini-2.5-flash`) |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`) — lo setea Next.js automáticamente |
