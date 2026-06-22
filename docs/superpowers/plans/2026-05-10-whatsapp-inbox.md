# Plan: Bandeja de Conversaciones WhatsApp
**Fecha:** 2026-05-10  
**Fase:** 1.1 — Operación Core  
**Objetivo:** Staff puede ver mensajes WhatsApp entrantes, responder desde la app, y gestionar el estado de cada conversación.

---

## Arquitectura

```
Meta Cloud API → POST /api/whatsapp/webhook
  → HMAC validate
  → webhook_queue INSERT (existente, para n8n)
  → conversations UPSERT (nuevo — por contact_phone + branch_id)
  → messages INSERT (nuevo — mensaje individual)
  → return 200

Staff en /inbox/conversations
  → lee conversations + últimos mensajes (RLS por organization_id)
  → hace clic → /inbox/conversations/[id]
  → ve thread de mensajes (burbuja estilo WhatsApp)
  → escribe respuesta → Server Action → WhatsApp API → guarda outbound message

WhatsApp API (envío)
  → lib/whatsapp/send.ts
  → descifra access_token_enc de branch_whatsapp_config
  → POST graph.facebook.com/v20.0/{phone_number_id}/messages
```

## Stack
- DB: Supabase PostgreSQL, RLS por organization_id
- Backend: Next.js Server Actions + Route Handlers
- IA: Gemini 2.5 Flash (clasificación de heat: hot/warm/cold)
- Canal: WhatsApp Cloud API (Meta Graph v20.0)
- UI: Server Components + 1 Client Component (MessageComposer)

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/20260510000001_conversations.sql` | CREAR — tablas conversations + messages + RLS |
| `app/api/whatsapp/webhook/route.ts` | MODIFICAR — extraer mensaje y upsert conversation/message |
| `lib/whatsapp/send.ts` | CREAR — helper para enviar mensajes vía Meta API |
| `lib/whatsapp/extract.ts` | CREAR — helpers para extraer datos del payload de Meta |
| `lib/inbox/conversations.ts` | CREAR — queries para conversations + messages |
| `app/actions/conversations.ts` | CREAR — sendMessage, resolveConversation, assignConversation |
| `app/(dashboard)/inbox/page.tsx` | MODIFICAR — agregar sección "Conversaciones WhatsApp" arriba |
| `app/(dashboard)/inbox/conversations/[id]/page.tsx` | CREAR — thread de mensajes |
| `app/(dashboard)/inbox/conversations/[id]/MessageComposer.tsx` | CREAR — input de respuesta (client component) |

---

## Task 1: Migración DB — conversations + messages

**Archivo:** `supabase/migrations/20260510000001_conversations.sql`

```sql
BEGIN;

-- ── conversations ──────────────────────────────────────────────────────────
-- Una conversación por número de teléfono del contacto + branch.
-- Se upsert cada vez que llega un mensaje nuevo del mismo número.
CREATE TABLE public.conversations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id            UUID        NOT NULL REFERENCES public.branches(id),
  patient_id           UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  channel              TEXT        NOT NULL DEFAULT 'whatsapp',
  contact_phone        TEXT        NOT NULL,
  contact_name         TEXT,
  status               TEXT        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open','assigned','resolved')),
  assigned_to          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_heat            TEXT        CHECK (lead_heat IN ('hot','warm','cold')),
  unread_count         INT         NOT NULL DEFAULT 0,
  last_message_at      TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, branch_id, contact_phone, channel)
);

CREATE INDEX idx_conv_org_branch   ON public.conversations(organization_id, branch_id, last_message_at DESC);
CREATE INDEX idx_conv_status       ON public.conversations(organization_id, status);
CREATE INDEX idx_conv_patient      ON public.conversations(patient_id) WHERE patient_id IS NOT NULL;

CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── messages ───────────────────────────────────────────────────────────────
-- Un registro por mensaje enviado o recibido en una conversación.
CREATE TABLE public.messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL,
  wamid           TEXT        UNIQUE,
  direction       TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
  body            TEXT,
  media_type      TEXT        CHECK (media_type IN ('text','image','audio','video','document','sticker','location','reaction')),
  media_url       TEXT,
  status          TEXT        NOT NULL DEFAULT 'received'
                              CHECK (status IN ('received','sent','delivered','read','failed')),
  sent_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msg_conversation ON public.messages(conversation_id, created_at ASC);
CREATE INDEX idx_msg_wamid        ON public.messages(wamid) WHERE wamid IS NOT NULL;
CREATE INDEX idx_msg_org          ON public.messages(organization_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- conversations: org members can read/update conversations in their org
CREATE POLICY "org members read conversations"
  ON public.conversations FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "org members update conversations"
  ON public.conversations FOR UPDATE
  USING (public.is_org_member(organization_id));

-- messages: org members can read messages of conversations they can access
CREATE POLICY "org members read messages"
  ON public.messages FOR SELECT
  USING (public.is_org_member(organization_id));

-- Insert via service role only (webhook handler + send action use admin client)
-- No INSERT policy needed for authenticated users — actions use admin client

COMMIT;
```

**Verificar:** En Supabase Studio → Table Editor → `conversations` y `messages` existen con las columnas correctas.

---

## Task 2: Helpers de extracción del payload de Meta

**Archivo:** `lib/whatsapp/extract.ts` (CREAR)

```typescript
// Extracts structured data from a Meta WhatsApp Cloud API payload.
// Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface ExtractedMessage {
  wamid: string
  contactPhone: string    // Full E.164, e.g. "51987654321"
  contactName: string | null
  body: string | null
  mediaType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'reaction'
  mediaUrl: string | null
}

export function extractInboundMessage(
  payload: Record<string, unknown>
): ExtractedMessage | null {
  try {
    const entry   = (payload.entry  as unknown[])?.[0] as Record<string, unknown>
    const change  = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
    const value   = change?.value   as Record<string, unknown>
    const msgs    = value?.messages  as unknown[]
    if (!msgs?.length) return null   // status update, not a message

    const msg     = msgs[0] as Record<string, unknown>
    const wamid   = msg.id as string
    const type    = (msg.type as string) ?? 'text'
    const contact = (value.contacts as unknown[])?.[0] as Record<string, unknown>
    const phone   = (contact?.wa_id as string) ?? null
    if (!phone || !wamid) return null

    const name    = ((contact?.profile as Record<string, unknown>)?.name as string) ?? null

    let body: string | null = null
    let mediaUrl: string | null = null

    if (type === 'text') {
      body = (msg.text as Record<string, unknown>)?.body as string ?? null
    } else if (type === 'image' || type === 'video' || type === 'document' || type === 'audio' || type === 'sticker') {
      const mediaObj = msg[type] as Record<string, unknown> | undefined
      mediaUrl = (mediaObj?.url ?? mediaObj?.id) as string | null
    } else if (type === 'location') {
      const loc = msg.location as Record<string, unknown>
      body = `📍 ${loc?.name ?? ''} (${loc?.latitude}, ${loc?.longitude})`
    } else if (type === 'reaction') {
      const reaction = msg.reaction as Record<string, unknown>
      body = `${reaction?.emoji ?? '👍'}`
    }

    return {
      wamid,
      contactPhone: phone,
      contactName: name,
      body,
      mediaType: type as ExtractedMessage['mediaType'],
      mediaUrl,
    }
  } catch {
    return null
  }
}
```

**Verificar:** `extractInboundMessage` retorna null para payloads de status, y retorna el objeto correcto para mensajes de texto.

---

## Task 3: WhatsApp send helper

**Archivo:** `lib/whatsapp/send.ts` (CREAR)

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken }       from '@/lib/crypto/whatsapp-token'

interface SendTextOptions {
  branchId: string
  to: string        // E.164 phone number of recipient
  body: string
}

interface SendResult {
  wamid: string | null
  error: string | null
}

export async function sendWhatsAppText(opts: SendTextOptions): Promise<SendResult> {
  const sb = createAdminClient()

  const { data: config } = await sb
    .from('branch_whatsapp_config')
    .select('phone_number_id, access_token_enc')
    .eq('branch_id', opts.branchId)
    .eq('status', 'active')
    .single()

  if (!config) {
    return { wamid: null, error: 'No active WhatsApp config for this branch' }
  }

  let accessToken: string
  try {
    accessToken = decryptToken(config.access_token_enc)
  } catch {
    return { wamid: null, error: 'Failed to decrypt WhatsApp access token' }
  }

  const url = `https://graph.facebook.com/v20.0/${config.phone_number_id}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'text',
      text: { body: opts.body },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[wa-send] error', err)
    return { wamid: null, error: `WhatsApp API error: ${res.status}` }
  }

  const data = await res.json() as { messages?: { id: string }[] }
  const wamid = data.messages?.[0]?.id ?? null
  return { wamid, error: null }
}
```

**Verificar:** Importar y llamar a `sendWhatsAppText` desde un Server Action retorna `{ wamid: "wamid_xxx", error: null }` cuando la config es válida.

---

## Task 4: Actualizar webhook handler

**Archivo:** `app/api/whatsapp/webhook/route.ts` — MODIFICAR el bloque POST

Después del `await sb.from('webhook_queue').insert(...)`, agregar:

```typescript
// Extract and store the message for the inbox UI.
// Runs after webhook_queue insert — if this fails, the queue entry still exists for n8n.
const extracted = extractInboundMessage(payload)
if (extracted) {
  // Upsert conversation (idempotent by unique constraint on org+branch+phone+channel)
  const { data: conv } = await sb
    .from('conversations')
    .upsert({
      organization_id:      config.organization_id,
      branch_id:            config.branch_id,
      contact_phone:        extracted.contactPhone,
      contact_name:         extracted.contactName,
      channel:              'whatsapp',
      last_message_at:      new Date().toISOString(),
      last_message_preview: extracted.body?.slice(0, 120) ?? '[media]',
      updated_at:           new Date().toISOString(),
    }, {
      onConflict: 'organization_id,branch_id,contact_phone,channel',
      ignoreDuplicates: false,
    })
    .select('id')
    .single()

  if (conv?.id) {
    // Increment unread counter
    await sb.rpc('increment_unread', { p_conversation_id: conv.id })

    // Insert message (on conflict wamid do nothing — idempotent)
    await sb.from('messages').upsert({
      conversation_id: conv.id,
      organization_id: config.organization_id,
      wamid:           extracted.wamid,
      direction:       'inbound',
      body:            extracted.body,
      media_type:      extracted.mediaType,
      media_url:       extracted.mediaUrl,
      status:          'received',
    }, { onConflict: 'wamid', ignoreDuplicates: true })
  }
}
```

También agregar en la parte superior del archivo:
```typescript
import { extractInboundMessage } from '@/lib/whatsapp/extract'
```

Y agregar la DB function en la migración (al final de `20260510000001_conversations.sql`):
```sql
-- Atomic unread counter increment
CREATE OR REPLACE FUNCTION public.increment_unread(p_conversation_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.conversations
  SET unread_count = unread_count + 1
  WHERE id = p_conversation_id;
$$;
```

**Verificar:** Enviar un mensaje de prueba al número de WhatsApp → verificar que aparece en `conversations` y `messages` en Supabase Studio.

---

## Task 5: Queries para conversations

**Archivo:** `lib/inbox/conversations.ts` (CREAR)

```typescript
import { createClient } from '@/lib/supabase/server'

export interface Conversation {
  id: string
  contactPhone: string
  contactName: string | null
  patientId: string | null
  patientName: string | null
  status: 'open' | 'assigned' | 'resolved'
  leadHeat: 'hot' | 'warm' | 'cold' | null
  unreadCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  assignedTo: string | null
}

export interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  body: string | null
  mediaType: string
  mediaUrl: string | null
  status: string
  sentBy: string | null
  createdAt: string
}

export async function fetchConversations(
  organizationId: string,
  branchId: string | null
): Promise<Conversation[]> {
  const sb = await createClient()

  let query = sb
    .from('conversations')
    .select(`
      id, contact_phone, contact_name, patient_id, status,
      lead_heat, unread_count, last_message_at, last_message_preview, assigned_to,
      patients(full_name)
    `)
    .eq('organization_id', organizationId)
    .neq('status', 'resolved')
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data } = await query
  return (data ?? []).map((r) => ({
    id: r.id,
    contactPhone: r.contact_phone,
    contactName: r.contact_name,
    patientId: r.patient_id,
    patientName: (r.patients as { full_name: string } | null)?.full_name ?? null,
    status: r.status as Conversation['status'],
    leadHeat: r.lead_heat as Conversation['leadHeat'],
    unreadCount: r.unread_count,
    lastMessageAt: r.last_message_at,
    lastMessagePreview: r.last_message_preview,
    assignedTo: r.assigned_to,
  }))
}

export async function fetchConversationMessages(
  organizationId: string,
  conversationId: string
): Promise<Message[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('messages')
    .select('id, direction, body, media_type, media_url, status, sent_by, created_at')
    .eq('conversation_id', conversationId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(100)

  return (data ?? []).map((m) => ({
    id: m.id,
    direction: m.direction as 'inbound' | 'outbound',
    body: m.body,
    mediaType: m.media_type ?? 'text',
    mediaUrl: m.media_url,
    status: m.status,
    sentBy: m.sent_by,
    createdAt: m.created_at,
  }))
}

export async function fetchConversation(
  organizationId: string,
  conversationId: string
): Promise<Conversation | null> {
  const sb = await createClient()
  const { data } = await sb
    .from('conversations')
    .select(`
      id, contact_phone, contact_name, patient_id, status,
      lead_heat, unread_count, last_message_at, last_message_preview, assigned_to,
      patients(full_name)
    `)
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single()

  if (!data) return null
  return {
    id: data.id,
    contactPhone: data.contact_phone,
    contactName: data.contact_name,
    patientId: data.patient_id,
    patientName: (data.patients as { full_name: string } | null)?.full_name ?? null,
    status: data.status as Conversation['status'],
    leadHeat: data.lead_heat as Conversation['leadHeat'],
    unreadCount: data.unread_count,
    lastMessageAt: data.last_message_at,
    lastMessagePreview: data.last_message_preview,
    assignedTo: data.assigned_to,
  }
}
```

---

## Task 6: Server Actions para conversaciones

**Archivo:** `app/actions/conversations.ts` (CREAR)

```typescript
'use server'

import { revalidatePath }        from 'next/cache'
import { createAdminClient }     from '@/lib/supabase/admin'
import { sendWhatsAppText }      from '@/lib/whatsapp/send'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import { createClient }          from '@/lib/supabase/server'

interface ActionResult {
  ok: boolean
  error?: string
}

export async function sendMessage(
  conversationId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim()
  if (!body) return { ok: false, error: 'El mensaje no puede estar vacío' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return { ok: false, error: 'Sin organización activa' }

  const sb = createAdminClient()

  const { data: conv } = await sb
    .from('conversations')
    .select('contact_phone, branch_id')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single()

  if (!conv) return { ok: false, error: 'Conversación no encontrada' }

  const result = await sendWhatsAppText({
    branchId: conv.branch_id,
    to: conv.contact_phone,
    body,
  })

  if (result.error) return { ok: false, error: result.error }

  await sb.from('messages').insert({
    conversation_id: conversationId,
    organization_id: organizationId,
    wamid:           result.wamid,
    direction:       'outbound',
    body,
    media_type:      'text',
    status:          'sent',
    sent_by:         user.id,
  })

  await sb
    .from('conversations')
    .update({
      last_message_at:      new Date().toISOString(),
      last_message_preview: `Tú: ${body.slice(0, 120)}`,
    })
    .eq('id', conversationId)

  revalidatePath(`/inbox/conversations/${conversationId}`)
  revalidatePath('/inbox')
  return { ok: true }
}

export async function resolveConversation(conversationId: string): Promise<void> {
  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const sb = createAdminClient()
  await sb
    .from('conversations')
    .update({ status: 'resolved', unread_count: 0 })
    .eq('id', conversationId)
    .eq('organization_id', organizationId)

  revalidatePath('/inbox')
  revalidatePath(`/inbox/conversations/${conversationId}`)
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const sb = createAdminClient()
  await sb
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .eq('organization_id', organizationId)

  revalidatePath('/inbox')
}

export async function assignConversationToMe(conversationId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const sb = createAdminClient()
  await sb
    .from('conversations')
    .update({ assigned_to: user.id, status: 'assigned' })
    .eq('id', conversationId)
    .eq('organization_id', organizationId)

  revalidatePath('/inbox')
  revalidatePath(`/inbox/conversations/${conversationId}`)
}
```

---

## Task 7: Actualizar inbox/page.tsx — agregar sección de conversaciones

En `app/(dashboard)/inbox/page.tsx`, importar y agregar al inicio del JSX (antes del header de "Bandeja unificada") la sección de conversaciones WhatsApp.

Agregar imports:
```typescript
import { fetchConversations } from '@/lib/inbox/conversations'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import { ConversationsSection } from '@/components/inbox/ConversationsSection'
```

Agregar al inicio del body de la función:
```typescript
const organizationId = await getActiveOrganizationId()
const branchId = await getActiveBranchId()
const conversations = organizationId
  ? await fetchConversations(organizationId, branchId)
  : []
```

Agregar antes del `<div className="max-w-4xl mx-auto space-y-6">`:
```tsx
{conversations.length > 0 && (
  <section className="mb-8">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        WhatsApp — Conversaciones activas
      </h2>
      <span className="text-xs text-gray-400">{conversations.length} conversaciones</span>
    </div>
    <div className="space-y-2">
      {conversations.map((conv) => (
        <ConversationCard key={conv.id} conversation={conv} />
      ))}
    </div>
  </section>
)}
```

Agregar `ConversationCard` como función en el mismo archivo:
```tsx
function ConversationCard({ conversation }: { conversation: Conversation }) {
  const heatColor = {
    hot: 'bg-red-100 text-red-700',
    warm: 'bg-amber-100 text-amber-700',
    cold: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className={`rounded-xl border bg-white p-4 flex items-center gap-4
      ${conversation.unreadCount > 0 ? 'border-brand-200 bg-brand-50/20' : 'border-gray-100'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {conversation.patientName ?? conversation.contactName ?? conversation.contactPhone}
          </p>
          {conversation.leadHeat && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${heatColor[conversation.leadHeat]}`}>
              {conversation.leadHeat === 'hot' ? 'Caliente' : conversation.leadHeat === 'warm' ? 'Tibio' : 'Frío'}
            </span>
          )}
          {conversation.unreadCount > 0 && (
            <span className="ml-auto text-xs font-bold text-white bg-brand-600 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{conversation.lastMessagePreview ?? '...'}</p>
      </div>
      <Link
        href={`/inbox/conversations/${conversation.id}`}
        className="text-xs text-brand-600 hover:underline font-medium flex-shrink-0"
      >
        Abrir →
      </Link>
    </div>
  )
}
```

---

## Task 8: Página de thread de conversación

**Archivo:** `app/(dashboard)/inbox/conversations/[id]/page.tsx` (CREAR)

```tsx
import Link              from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient }  from '@/lib/supabase/server'
import { getActiveOrganizationId } from '@/lib/tenant/context'
import { fetchConversation, fetchConversationMessages } from '@/lib/inbox/conversations'
import { resolveConversation, assignConversationToMe, markConversationRead } from '@/app/actions/conversations'
import { MessageComposer } from './MessageComposer'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) redirect('/org-selector')

  const [conversation, messages] = await Promise.all([
    fetchConversation(organizationId, id),
    fetchConversationMessages(organizationId, id),
  ])

  if (!conversation) notFound()

  // Mark as read on open
  await markConversationRead(id)

  const isResolved = conversation.status === 'resolved'
  const resolveAction = resolveConversation.bind(null, id)
  const assignAction  = assignConversationToMe.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <Link href="/inbox" className="text-sm text-gray-400 hover:text-gray-600">
          ← Bandeja
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            {conversation.patientName ?? conversation.contactName ?? conversation.contactPhone}
          </span>
          <span className="text-xs text-gray-400">{conversation.contactPhone}</span>
        </div>
        <div className="flex gap-2">
          {!conversation.assignedTo && !isResolved && (
            <form action={assignAction}>
              <button type="submit" className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">
                Asignarme
              </button>
            </form>
          )}
          {!isResolved && (
            <form action={resolveAction}>
              <button type="submit" className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium">
                Resolver
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Patient link if known */}
      {conversation.patientId && (
        <Link
          href={`/patients/${conversation.patientId}`}
          className="text-xs text-brand-600 hover:underline mb-3 flex-shrink-0"
        >
          Ver ficha del paciente →
        </Link>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 mt-8">Sin mensajes aún.</p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Composer */}
      {!isResolved && (
        <div className="flex-shrink-0 border-t pt-4">
          <MessageComposer conversationId={id} />
        </div>
      )}

      {isResolved && (
        <p className="text-center text-xs text-gray-400 py-4 flex-shrink-0">
          Conversación resuelta
        </p>
      )}

    </div>
  )
}

function MessageBubble({ message }: { message: import('@/lib/inbox/conversations').Message }) {
  const isOutbound = message.direction === 'outbound'
  const time = new Date(message.createdAt).toLocaleTimeString('es-PE', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm
        ${isOutbound
          ? 'bg-brand-600 text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
        {!message.body && message.mediaType !== 'text' && (
          <p className="italic text-xs opacity-70">[{message.mediaType}]</p>
        )}
        <p className={`text-[10px] mt-1 ${isOutbound ? 'text-white/70 text-right' : 'text-gray-400'}`}>
          {time}
        </p>
      </div>
    </div>
  )
}
```

---

## Task 9: MessageComposer (Client Component)

**Archivo:** `app/(dashboard)/inbox/conversations/[id]/MessageComposer.tsx` (CREAR)

```tsx
'use client'

import { useActionState, useRef, useEffect } from 'react'
import { sendMessage }                        from '@/app/actions/conversations'

interface Props {
  conversationId: string
}

type State = { ok: boolean; error?: string } | null

export function MessageComposer({ conversationId }: Props) {
  const boundAction = sendMessage.bind(null, conversationId)
  const [state, action, isPending] = useActionState<State, FormData>(boundAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear form on success
  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="flex gap-2 items-end">
      <textarea
        name="body"
        rows={2}
        required
        placeholder="Escribe tu respuesta..."
        className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-600 text-white px-5 py-3 rounded-xl text-sm font-semibold
                   hover:bg-brand-700 disabled:opacity-50 transition-colors flex-shrink-0"
      >
        {isPending ? '...' : 'Enviar'}
      </button>
    </form>
  )
}
```

---

## Checklist de verificación final

- [ ] Migración aplicada en Supabase — tablas `conversations` y `messages` existen
- [ ] `increment_unread` function existe en DB
- [ ] Enviar mensaje de prueba por WhatsApp → aparece en `conversations` y `messages`
- [ ] `/inbox` muestra sección de conversaciones WhatsApp con unread badge
- [ ] Abrir conversación → thread de mensajes visible
- [ ] Escribir respuesta → mensaje aparece en hilo con burbuja outbound + WhatsApp recibe el mensaje
- [ ] Botón "Resolver" cambia status → conversación desaparece del inbox
- [ ] TypeScript compila sin errores: `tsc --noEmit`

---

## Orden de ejecución

1. Task 1 — Migración DB (applica primero)
2. Task 2 — extract.ts
3. Task 3 — send.ts
4. Task 4 — webhook handler (depende de extract.ts)
5. Task 5 — conversations.ts queries
6. Task 6 — actions/conversations.ts (depende de send.ts + context)
7. Task 7 — inbox/page.tsx (depende de conversations.ts)
8. Task 8 — conversations/[id]/page.tsx (depende de queries + actions)
9. Task 9 — MessageComposer.tsx (depende de actions)
