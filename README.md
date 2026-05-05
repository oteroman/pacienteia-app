# Paciente IA — App

Copiloto operacional para clínicas estéticas en Lima. Multi-tenant SaaS construido con Next.js 15 + Supabase.

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Auth & DB:** Supabase (Postgres, Auth, RLS)
- **Hosting:** Vercel
- **Automatización:** n8n (interno, `automatizacion.pacienteia.com`)

## Requisitos

- Node.js 20+
- Cuenta de Supabase con el schema aplicado (ver `/supabase/migrations/`)

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hwuuuslpzxcgpfzdjrhz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
N8N_WEBHOOK_BASE_URL=https://automatizacion.pacienteia.com
```

> **Importante:** `SUPABASE_SERVICE_ROLE_KEY` nunca debe ir en código client-side.

### 3. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### 4. Usuarios de prueba (seed)

| Email | Contraseña | Rol |
|---|---|---|
| `owner@clinicabellaforma.com` | `Test1234!` | Owner (2 clínicas) |
| `admin@clinicabellaforma.com` | `Test1234!` | Admin (Bella Forma) |
| `staff@clinicabellaforma.com` | `Test1234!` | Staff (Bella Forma) |

## Flujo de usuario

```
/login
  ↓ autenticación con email/password
  ↓ 1 clínica → cookie active_clinic_id → /dashboard
  ↓ +1 clínica → /clinic-selector → selecciona → /dashboard
```

## Estructura de carpetas

```
app/
├── (auth)/login/          # Login page + Server Action
├── (dashboard)/
│   ├── layout.tsx         # NavHeader + ClinicProvider
│   └── dashboard/         # KPIs del día
├── auth/callback/         # Callback OAuth / email confirm
├── clinic-selector/       # Selector de clínica
└── actions/clinic.ts      # Server Action para cambiar clínica activa

components/
├── nav-header.tsx         # Barra de navegación
└── clinic-selector.tsx    # Dropdown para cambiar clínica

lib/
├── supabase/client.ts     # Supabase browser client
├── supabase/server.ts     # Supabase server client (SSR)
├── tenant/active-clinic.ts # Lectura/escritura del cookie de clínica
└── n8n/client.ts          # Webhook client (interno)

providers/
└── clinic-provider.tsx    # React Context con la clínica activa

types/
└── database.ts            # Tipos generados desde el schema de Supabase

middleware.ts              # Protección de rutas + refresco de sesión
```

## Regenerar tipos de Supabase

```bash
npm run types
```

Requiere `SUPABASE_ACCESS_TOKEN` configurado o ejecutar con:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npm run types
```

## Deploy en Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com)
2. Agrega las variables de entorno en el dashboard de Vercel
3. En **Supabase** > **Auth** > **URL Configuration**, configura:
   - **Site URL:** `https://app.pacienteia.com`
   - **Redirect URLs:** `https://app.pacienteia.com/auth/callback`

## Fases del proyecto

- **Fase 1** (actual): Auth, multi-clinic membership, dashboard shell
- **Fase 2**: CRUD pacientes y citas, RLS hardening, primer webhook a n8n
- **Fase 3**: Métricas, historial de automatizaciones
- **Fase 4**: Landing page pública en `pacienteia.com`
