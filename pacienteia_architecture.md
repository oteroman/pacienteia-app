# Paciente IA — Architecture Source of Truth

## Product overview

Paciente IA is a multi-tenant SaaS for aesthetic clinics and aesthetic doctors in Lima. The product acts as an operational copilot that helps clinics capture leads, confirm appointments, reduce no-shows, reactivate inactive patients, and automate post-treatment follow-up through web workflows, AI orchestration, and operational dashboards.[cite:319][cite:320]

The public product should be presented as Paciente IA, not as n8n or a generic chatbot. Internal workflow automation runs in a hidden backoffice domain, while the client-facing experience remains a branded SaaS product.[cite:322][cite:319]

## Domain architecture

Use the following domain structure:

| Purpose | Domain | Notes |
|---|---|---|
| Marketing website | `pacienteia.com` | Public landing page with product explanation, pricing, demo CTA, and login button. |
| SaaS application | `app.pacienteia.com` | Centralized login and application access for all clinics. |
| Internal automation backoffice | `automatizacion.pacienteia.com` | Internal-only n8n instance for agents, webhooks, orchestration, and operations. Never exposed in product marketing or client UX. |

This project should **not** use a separate subdomain per clinic in version 1. The recommended architecture is centralized application access with multi-tenant organization membership inside the app, because a single user may belong to more than one clinic and should choose the active clinic after login instead of remembering multiple subdomains.[cite:322][cite:7][cite:319]

## Core product decision

Paciente IA v1 uses:
- One centralized app entry point: `app.pacienteia.com`
- Multi-tenant architecture by clinic/organization
- One user can belong to one or many clinics
- If user belongs to one clinic, redirect directly into that clinic context
- If user belongs to multiple clinics, show a clinic selector after login
- Internal automation is handled in `automatizacion.pacienteia.com`

## Primary users

| User type | Description | Main goal |
|---|---|---|
| Owner | Clinic owner or manager | See business impact, appointments, retention, lost leads, and ROI |
| Admin | Clinic administrator or head receptionist | Manage patients, appointments, follow-up, staff operations |
| Staff | Reception or support staff | View and update patients, appointments, notes, statuses |

Patients are not first-class authenticated users in v1. The first version is B2B operational software for clinics, not a patient portal.

## Main problems solved

Paciente IA v1 solves these operational problems for aesthetic clinics:
- Slow or inconsistent response to new WhatsApp or web leads
- Missed appointment confirmations and high no-show rates
- Poor follow-up after procedures
- No structured reactivation of inactive patients
- No operational visibility into lost revenue from cancellations, no-shows, and lost leads

This product is inspired by categories already growing internationally in beauty, wellness, med-spa, and clinical AI operations, where platforms focus on AI reception, lead handling, no-show reduction, and operational workflow automation.[cite:355][cite:363]

## System architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend + web app | Next.js 15 + App Router + TypeScript | Main SaaS application |
| Hosting | Vercel | Deployment of web app |
| Database + Auth | Supabase | Postgres, Auth, RLS, file storage |
| Automation backend | n8n on Hetzner | Workflows, webhooks, AI orchestration, background tasks |
| AI providers | Claude / Gemini / Perplexity where needed | Classification, summarization, suggestions |

## Data architecture

Use a centralized multi-tenant data model in Supabase.

### Required base entities

| Table | Purpose |
|---|---|
| `profiles` | App user profile linked to `auth.users` |
| `clinics` | Tenant / organization |
| `clinic_members` | Membership of users inside clinics with role |
| `patients` | Patients belonging to a clinic |
| `appointments` | Appointments for a patient in a clinic |
| `lead_events` | Raw events related to inbound leads |
| `workflow_runs` | Records of automation triggers and results |
| `metrics_daily` | Daily KPI snapshots per clinic |

### Multi-tenant rule

Every business table must contain `clinic_id`, except user identity tables. Access must be controlled with Row Level Security based on membership in `clinic_members`.

## Auth model

Use Supabase Auth with a centralized login at `app.pacienteia.com`.

### Auth behavior
- Email/password in v1
- Optional Google login later
- Middleware protects all private routes
- User lands in clinic selector if member of multiple clinics
- User lands directly in dashboard if member of only one clinic

### Roles

| Role | Permissions |
|---|---|
| `owner` | Full control of clinic, billing later, settings, staff, KPIs |
| `admin` | Operational management, patients, appointments, workflows |
| `staff` | Limited day-to-day operations |

## v1 functional modules

Paciente IA v1 should include only these modules:

### 1. Authentication
- Login
- Logout
- Protected dashboard
- Clinic selector

### 2. Clinic dashboard
- Summary cards: active patients, appointments today, no-shows, recovered patients, estimated recovered revenue
- Recent activity
- Operational alerts

### 3. Patients
- List of patients
- Create/edit patient
- Patient status
- Last visit date
- Contact details
- Notes

### 4. Appointments
- List of appointments
- Create/edit appointment
- Appointment status: scheduled, confirmed, completed, cancelled, no_show
- Treatment type
- Assigned staff optional

### 5. Automations
- Trigger selected automation manually
- Show last webhook execution
- Show automation status per patient or appointment

### 6. Metrics
- Daily operational KPIs by clinic
- Recovered patients
- No-shows avoided
- Estimated revenue recovered

## n8n integration rules

The n8n instance at `automatizacion.pacienteia.com` is internal infrastructure only. It should never appear in visible branding, customer navigation, or product copy.[cite:322]

### Integration pattern
- App writes operational data to Supabase
- App or database event triggers webhook to n8n
- n8n processes workflow
- n8n writes status/result back to Supabase
- App reads updated state from Supabase

### Webhook contracts for v1

| Event | Trigger source | Expected n8n action |
|---|---|---|
| `lead.created` | New lead/patient entered | Classify lead, assign priority, prepare follow-up |
| `appointment.created` | New appointment | Schedule confirmation workflow |
| `appointment.upcoming` | Time-based event | Send reminders and flag risk |
| `patient.inactive` | Time-based rule | Start reactivation workflow |
| `post_treatment.followup` | Completed appointment | Start post-treatment follow-up |

### Integration discipline
- All webhook payloads must include `clinic_id`
- All webhook payloads must include a stable `event_type`
- Every n8n run should create or update a row in `workflow_runs`
- Failures should be visible in app UI later

## UX rules

### Public website
`pacienteia.com` should be a modern SaaS landing page with:
- clear problem/solution framing
- clinic-focused value proposition
- ROI language around no-shows, retention, and follow-up
- CTA for demo
- CTA for login

### Application UX
`app.pacienteia.com` should feel like a real SaaS product, not a workflow tool.

Important UX rules:
- Clean, premium, healthcare-adjacent interface
- Mobile-friendly for clinic staff
- Clear active clinic context visible at all times
- Never expose technical internal terms like “n8n”, “workflow engine”, or “automation backend” to end users

## Security rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code
- Use RLS in every tenant table
- Scope every query by clinic membership
- Treat automation endpoints as internal integration surfaces
- Keep the n8n admin domain hidden from customers

## Environment variables

### Web app
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

### Expected values in production
- `NEXT_PUBLIC_APP_URL=https://app.pacienteia.com`
- `N8N_WEBHOOK_BASE_URL=https://automatizacion.pacienteia.com`

## Folder and code expectations

The codebase should be prepared for Vercel deployment and structured by feature, not by chaos.

Suggested areas:
- `app/(auth)` for login flows
- `app/(dashboard)` for private app routes
- `components/` for reusable UI
- `lib/supabase/` for auth/database clients
- `lib/tenant/` for active clinic resolution
- `lib/n8n/` for webhook client and payload contracts
- `types/` for domain types

## Implementation phases

### Phase 1
- Next.js app base
- Supabase connection
- Auth
- Multi-clinic membership model
- Clinic selector
- Dashboard shell

### Phase 2
- Patients CRUD
- Appointments CRUD
- RLS hardening
- First webhook integration to n8n

### Phase 3
- Metrics dashboard
- Workflow execution history
- Reactivation and no-show automation UI

### Phase 4
- Public landing page on `pacienteia.com`
- Demo funnel
- Lead capture forms
- Billing later

## Non-goals for v1

Do not build these in the first version:
- patient self-service portal
- advanced billing
- subdomain per clinic
- multilingual support
- full white-labeling per clinic
- overly complex calendar sync

## Claude Code working model

Use a multi-agent workflow with explicit responsibility boundaries.

Recommended agents:
- Architect agent: defines structure, contracts, naming, and acceptance criteria
- Supabase agent: SQL, RLS, auth, migrations, relationships
- Next.js/Vercel agent: app routes, UI, auth flow, middleware
- Reviewer agent: consistency, security, tenant isolation, env validation

Agents must not invent product scope outside this document.

## Acceptance criteria for initial scaffold

The initial generated project is acceptable only if it meets all of the following:
- Runs locally with Next.js and Supabase env variables
- Has centralized login at `app.pacienteia.com`
- Supports user membership in one or many clinics
- Protects routes with middleware
- Has SQL schema for `profiles`, `clinics`, and `clinic_members`
- Enforces tenant isolation with RLS
- Includes a post-login clinic selection flow
- Is deployment-ready for Vercel
- Does not expose n8n to end users
