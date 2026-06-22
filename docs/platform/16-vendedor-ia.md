# 16 — Vendedor IA (Paxi)

## Qué es

Bot de WhatsApp para captar y calificar prospectos interesados en contratar PacienteIA. Usa un número de WhatsApp propio del equipo de ventas de PacienteIA (separado de los números de las clínicas). El bot se llama **Paxi**.

No es una feature para las clínicas — es infraestructura interna de ventas de PacienteIA como empresa.

---

## Arquitectura

```
Prospecto escribe a +51 934 123 012
        ↓
POST /api/whatsapp/sales/webhook
  - HMAC validado con SALES_WHATSAPP_APP_SECRET
  - App Meta separada (App ID: 1391162663028970)
        ↓
handleSalesBotMessage() → lib/platform/sales-bot.ts
  - Máquina de estados conversacional
  - Guarda progreso en sales_prospects (Supabase)
        ↓
sendSalesWhatsApp() → lib/platform/sales-send.ts
  - Usa SALES_WHATSAPP_ACCESS_TOKEN + SALES_WHATSAPP_PHONE_NUMBER_ID
```

### Por qué una app Meta separada

Las clínicas usan su propia app de Meta para facturar su propio consumo de mensajes. El número de ventas de PacienteIA también tiene su propia app para mantener separada la facturación y la responsabilidad operativa.

---

## Flujo conversacional de Paxi

| Paso | Estado (`flow_step`) | Qué hace |
|------|---------------------|----------|
| 1 | `awaiting_name` | Saluda, pide nombre |
| 2 | `awaiting_clinic` | Pregunta nombre de clínica |
| 3 | `awaiting_size` | Menú numerado: volumen de citas/mes (1-4) |
| 4 | `awaiting_pain` | Menú numerado: dolor principal (1-4) |
| 5 | `awaiting_demo_interest` | Pitch personalizado según dolor + "¿quieres demo?" |
| 6 | `awaiting_email` | Pide email para coordinar demo |
| 7 | `closed` | Confirmación, status → `demo_requested` |

### Dolores y pitches

| # | Dolor | Pitch |
|---|-------|-------|
| 1 | Muchos no-shows | Recordatorios automáticos 24h y 2h, reducción 40% |
| 2 | WhatsApp manual | 80% de mensajes automatizados, agendamiento por WA |
| 3 | Slots vacíos | Backfill inteligente — detecta cancelaciones y ofrece el slot |
| 4 | Pacientes que no vuelven | Score de retención + campaña de reactivación automática |

---

## Tabla `sales_prospects`

```sql
id, phone (UNIQUE), contact_name, clinic_name, monthly_apts,
pain_point, email, status, flow_step, flow_data JSONB,
notes, created_at, updated_at
```

**Status posibles:** `new` → `qualifying` → `demo_requested` → `converted` / `disqualified`

---

## Pipeline (`/platform/sales`)

Visible solo para superadmins en el panel de plataforma (`/platform`).

- KPIs: Total / Calificando / Demo solicitada / Convertidos
- Tabla con todos los prospectos: nombre, clínica, volumen, dolor, email, estado
- Acción "Convertir" para prospects con `demo_requested`

---

## Configuración Meta

| Variable | Valor |
|----------|-------|
| App ID | `1391162663028970` |
| Phone Number ID | `1137176299476928` |
| WABA ID | `1934173367535430` |
| Webhook URL | `https://app.pacienteia.com/api/whatsapp/sales/webhook` |
| Verify Token | Mismo `WHATSAPP_VERIFY_TOKEN` que las clínicas |

### Env vars en Vercel

| Variable | Descripción |
|----------|-------------|
| `SALES_WHATSAPP_APP_SECRET` | App Secret de la app Meta del bot de ventas |
| `SALES_WHATSAPP_ACCESS_TOKEN` | System User Token permanente del WABA de ventas |
| `SALES_WHATSAPP_PHONE_NUMBER_ID` | ID del número `+51 934 123 012` |

### Pasos de activación realizados

1. Número `+51 934 123 012` registrado vía `/v20.0/{phone_number_id}/register` con PIN
2. Webhook configurado en Meta → WhatsApp → Configuración
3. Campo `messages` suscrito en el webhook
4. WABA suscrito a la app: `POST /v20.0/{waba_id}/subscribed_apps`
5. App pendiente de App Review para pasar a modo Live (permisos: `whatsapp_business_messaging` + `whatsapp_business_management`)

---

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `lib/platform/sales-bot.ts` | Máquina de estados conversacional (Paxi) |
| `lib/platform/sales-send.ts` | Envía WhatsApp usando credenciales del bot de ventas |
| `app/api/whatsapp/sales/webhook/route.ts` | Webhook separado con HMAC propio |
| `app/platform/sales/page.tsx` | Pipeline de prospectos (superadmin) |
| `supabase/migrations/20260513000001_sales_bot.sql` | Tabla `sales_prospects` |
