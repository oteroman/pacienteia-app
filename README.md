# PacienteIA — App

Copiloto operacional con IA para clínicas en Lima, Perú. SaaS B2B multi-tenant construido con Next.js 15 + Supabase. Automatiza operaciones vía WhatsApp: captación de leads, confirmación de citas, recordatorios, bandeja unificada y análisis operativo.

> **Regla de Hierro:** La IA nunca da diagnósticos, prescripciones ni consejos de salud. Solo gestiona operaciones.

**URLs:**
- App: [https://app.pacienteia.com](https://app.pacienteia.com)
- Landing: [https://pacienteia.com](https://pacienteia.com)
- n8n: [https://automatizacion.pacienteia.com](https://automatizacion.pacienteia.com)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, React 19, Server Components) |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password + invite por email) |
| Estilos | Tailwind CSS + design tokens CSS custom properties |
| IA | Google Gemini (clasificación de intakes, tareas, sugerencias, predicción abandono) |
| Automatizaciones | n8n (10 workflows activos vía webhook_queue) |
| WhatsApp | Meta Cloud API (webhook → procesamiento → acciones) |
| Deploy | Vercel (`npx vercel --prod`) |
| Lenguaje | TypeScript estricto · UI en español · código en inglés |

---

## Arquitectura Multi-Tenant

```
Organization (clínica / consultorio)
  └── Branch (sucursal)
        ├── org_members      (owner / admin / staff)
        ├── professionals    (doctores / terapeutas)
        ├── services         (catálogo con precio y duración)
        ├── doctor_schedules (disponibilidad semanal)
        ├── schedule_blocks  (bloqueos: feriados, vacaciones)
        ├── patients
        ├── appointments     → professional_id
        ├── conversations    (hilos WhatsApp)
        └── intakes          (leads del funnel)
```

Contexto activo por cookies `active_organization_id` + `active_branch_id`. RLS vía `is_org_member()`.

---

## Setup Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
# Solicitar al equipo o bajar de Vercel con:
npx vercel env pull .env.local
```

Variables requeridas:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hwuuuslpzxcgpfzdjrhz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=<gemini-key>
CRON_SECRET=<CRON_SECRET_ROTAR>
N8N_WEBHOOK_URL=https://automatizacion.pacienteia.com/webhook/...
```

> `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` nunca van en client-side.

### 3. Correr en desarrollo

```bash
npm run dev
```

### 4. Credenciales demo (La Rosa)

| Campo | Valor |
|-------|-------|
| Email | `juanramirez20932@gmail.com` |
| Organization ID | `860dee6e-612e-4673-87cc-1ccefd602f46` |
| Branch ID | `1e51d833-00b4-4233-acbb-44a55b0f62a1` |

---

## Módulos Implementados

### Core Operacional
- **Dashboard** — KPIs del día, agenda clicable, alertas, score de retención
- **Pacientes** — CRUD, ficha 360 (citas, WA, reactivación, tareas IA, score)
- **Citas** — CRUD con profesional/servicio/horario, notas inline, cancelación
- **Copiloto IA** — Tareas generadas por Gemini, historial, detalle por tarea

### WhatsApp & Comunicaciones
- **Bandeja unificada** — Conversaciones WA + leads/formularios en una sola vista mobile-first
- **Hilo de conversación** — Mensajes en tiempo real (polling 15s + Supabase Realtime)
- **Compositor inteligente** — Sugerencia de respuesta por Gemini, plantillas rápidas
- **Plantillas de respuesta** — 15 plantillas base (confirmación, recordatorio, seguimiento, reactivación, promoción, general)

### Automatizaciones WhatsApp (n8n)
| Automatización | Trigger |
|----------------|---------|
| Recordatorio 24h | CRON 8AM Lima |
| Recordatorio 2h | Cada hora 7-15h Lima |
| Encuesta post-cita (NPS) | 4-10h post-atención |
| Reactivación paso 1 | L-V 10AM Lima |
| Reactivación paso 2 (follow-up) | Lunes 10AM Lima |
| Reagendamiento escalación | Cada hora |
| Flash Offers (slots vacíos) | Diario medianoche |
| Smart Buffer (demoras) | Cada 30 min |
| Reporte ROI semanal | Lunes 8AM Lima |
| Predictor Abandono (Gemini) | Lunes 11PM Lima |

### Leads & Captación
- **Pipeline de leads** — Lista con filtros por estado, stepper de transición, timeline de eventos
- **Intakes webhook** — TikTok Leads API + webform → normalización Gemini → bandeja
- **SLA de respuesta** — Escalación automática por tiempo sin atención

### Analytics
- **Dashboard principal** — Funnel leads→citas→completadas, eficiencia, selector de período
- **Recordatorios** — Tasa de confirmación, no-shows, efectividad por hora
- **Reputación** — NPS, Google Reviews, escudo de reseñas negativas
- **Reactivación** — Embudo de campañas, respuestas, citas generadas
- **Revenue** — Ingresos, oportunidades de ciclo, backfill de slots

### Configuración
- **Profesionales** — CRUD con color picker, vinculado a citas y horarios
- **Horarios** — Disponibilidad semanal por profesional + bloqueos de fecha
- **Servicios** — Catálogo con precio base, duración y ciclo de retratamiento
- **Staff** — Invitación por email, roles (owner/admin/staff), quitar miembros
- **WhatsApp** — Configuración por branch (token, número, Google Review URL)
- **Automatizaciones** — Toggle por flujo sin tocar n8n
- **Plantillas** — CRUD de respuestas rápidas con categorías

### Plataforma (Superadmin)
- **Panel de tenants** — Lista, detalle, impersonación, métricas
- **Vendedor IA (Paxi)** — Bot WhatsApp de captación de prospectos PacienteIA
- **Auditoría** — Log de acciones por tenant

---

## Migraciones Supabase

PowerShell no funciona bien con `Invoke-RestMethod` para esto. Usar Node.js HTTPS:

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
    'Authorization': 'Bearer <PAT>',
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

---

## Deploy

```bash
npx vercel --prod
```

El build incluye validación de tipos (salvo que esté desactivada en `next.config.ts`).
