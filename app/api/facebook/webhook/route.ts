import { NextRequest, NextResponse } from 'next/server'
import crypto                         from 'crypto'
import { createAdminClient }          from '@/lib/supabase/admin'
import { processIntake }              from '@/app/actions/intake'
import { handleSalesBotMessage }      from '@/lib/platform/sales-bot'
import { sendPaxiFacebook, sendPaxiInstagram } from '@/lib/platform/sales-send-social'

// ── Verify webhook (GET) ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

// ── Receive events (POST) ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // HMAC verification
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (appSecret) {
    const sig = req.headers.get('x-hub-signature-256') ?? ''
    const raw = await req.text()
    const expected = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(raw)
      .digest('hex')
    if (sig !== expected) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
    try {
      await handlePayload(JSON.parse(raw))
    } catch {
      // non-blocking — Meta expects 200 regardless
    }
  } else {
    try {
      const payload = await req.json()
      await handlePayload(payload)
    } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true })
}

// ── Platform page IDs (PacienteIA's own pages) ──────────────────────────────

async function getPlatformPageIds(): Promise<{ pageId: string | null; igId: string | null }> {
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('platform_social_config')
    .select('page_id, instagram_account_id')
    .eq('platform', 'facebook')
    .maybeSingle()
  return { pageId: data?.page_id ?? null, igId: data?.instagram_account_id ?? null }
}

// ── Event dispatcher ─────────────────────────────────────────────────────────

async function handlePayload(payload: Record<string, unknown>) {
  const object = payload.object as string
  const entries = (payload.entry as Record<string, unknown>[]) ?? []

  const { pageId: platformPageId, igId: platformIgId } = await getPlatformPageIds()

  for (const entry of entries) {
    const pageId  = entry.id as string
    const changes = (entry.changes as Record<string, unknown>[]) ?? []
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? []

    // Lead Ads event (from page subscription)
    for (const change of changes) {
      if (change.field === 'leadgen') {
        const val = change.value as Record<string, unknown>
        // Lead Ads from PacienteIA's own page → sales_prospects, not intakes
        if (platformPageId && pageId === platformPageId) {
          await handlePaxiLeadAd(val)
        } else {
          await handleLeadAd(pageId, val)
        }
      }
    }

    // Messenger or Instagram DM
    for (const event of messaging) {
      const sender    = (event.sender as { id: string })?.id
      const recipient = (event.recipient as { id: string })?.id
      const message   = event.message as Record<string, unknown> | undefined

      if (!sender || !message || message.is_echo) continue

      const channel: 'facebook_messenger' | 'instagram' =
        object === 'instagram' ? 'instagram' : 'facebook_messenger'

      const recipientId = recipient ?? pageId

      // Check if this is PacienteIA's own page → route to Paxi sales bot
      const isPlatformPage =
        (channel === 'facebook_messenger' && platformPageId && recipientId === platformPageId) ||
        (channel === 'instagram'          && platformIgId   && recipientId === platformIgId)

      if (isPlatformPage) {
        const text = message.text as string | undefined
        if (text?.trim()) {
          // Prefix PSID so it doesn't collide with WhatsApp phone numbers in sales_prospects
          const prospectKey = `${channel === 'instagram' ? 'ig' : 'fb'}:${sender}`
          const sendFn = channel === 'instagram' ? sendPaxiInstagram : sendPaxiFacebook
          await handleSalesBotMessage(prospectKey, text.trim(), sendFn)
        }
      } else {
        await handleInboundMessage({
          channel,
          pageOrIgId: recipientId,
          senderId:   sender,
          messageId:  message.mid as string | undefined,
          text:       message.text as string | undefined,
          timestamp:  event.timestamp as number | undefined,
        })
      }
    }
  }
}

// ── Inbound message → conversation ──────────────────────────────────────────

async function handleInboundMessage(opts: {
  channel: 'facebook_messenger' | 'instagram'
  pageOrIgId: string
  senderId: string
  messageId?: string
  text?: string
  timestamp?: number
}) {
  const { channel, pageOrIgId, senderId, messageId, text, timestamp } = opts
  if (!text?.trim()) return

  const sb = createAdminClient() as any

  // Find org from social_connections
  let conn: { organization_id: string; branch_id: string | null } | null = null
  if (channel === 'facebook_messenger') {
    const { data } = await sb
      .from('social_connections')
      .select('organization_id, branch_id')
      .eq('page_id', pageOrIgId)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .maybeSingle()
    conn = data
  } else {
    const { data } = await sb
      .from('social_connections')
      .select('organization_id, branch_id')
      .eq('instagram_account_id', pageOrIgId)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .maybeSingle()
    conn = data
  }

  if (!conn) return

  const { organization_id: organizationId } = conn

  // Resolve branch — use connection's branch_id or fall back to first branch
  let branchId = conn.branch_id
  if (!branchId) {
    const { data: branch } = await sb
      .from('branches')
      .select('id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    branchId = branch?.id ?? null
  }
  if (!branchId) return

  // Upsert conversation (contact_phone holds the sender PSID/IGSID)
  const { data: conv, error: convErr } = await sb
    .from('conversations')
    .upsert({
      organization_id:  organizationId,
      branch_id:        branchId,
      channel,
      contact_phone:    senderId,
      status:           'open',
      last_message_at:  timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
      last_message_preview: text.slice(0, 120),
    }, {
      onConflict: 'organization_id,branch_id,contact_phone,channel',
      ignoreDuplicates: false,
    })
    .select('id')
    .single()

  if (convErr || !conv) return

  // Increment unread
  await sb.rpc('increment_unread', { p_conversation_id: conv.id })

  // Deduplicate by messageId
  if (messageId) {
    const { data: existing } = await sb
      .from('messages')
      .select('id')
      .eq('wamid', messageId)
      .maybeSingle()
    if (existing) return
  }

  // Insert message
  await sb.from('messages').insert({
    conversation_id: conv.id,
    organization_id: organizationId,
    wamid:           messageId ?? null,
    direction:       'inbound',
    body:            text,
    media_type:      'text',
    status:          'received',
  })
}

// ── PacienteIA Lead Ad → sales_prospect ─────────────────────────────────────

async function handlePaxiLeadAd(val: Record<string, unknown>) {
  const leadgenId = val.leadgen_id as string | undefined
  if (!leadgenId) return

  const sb = createAdminClient() as any
  const { data: config } = await sb
    .from('platform_social_config')
    .select('access_token')
    .eq('platform', 'facebook')
    .maybeSingle()
  if (!config) return

  const leadRes = await fetch(
    `https://graph.facebook.com/v21.0/${leadgenId}?fields=id,field_data&access_token=${config.access_token}`,
  )
  if (!leadRes.ok) return

  const lead = await leadRes.json() as { field_data: { name: string; values: string[] }[] }
  const fieldMap = Object.fromEntries(
    (lead.field_data ?? []).map((f) => [f.name.toLowerCase(), f.values?.[0] ?? ''])
  )

  const phone = fieldMap['phone_number'] ?? fieldMap['teléfono'] ?? fieldMap['telefono'] ?? fieldMap['phone'] ?? null
  const name  = fieldMap['full_name'] ?? fieldMap['nombre'] ?? fieldMap['name'] ?? null

  if (!phone) return

  // Upsert prospect — treat lead as a new prospect starting the flow
  await sb.from('sales_prospects').upsert(
    {
      phone,
      contact_name: name ?? undefined,
      flow_step:    'awaiting_clinic',
      status:       'new',
      metadata:     { leadgen_id: leadgenId, field_data: lead.field_data },
    },
    { onConflict: 'phone', ignoreDuplicates: true },
  )
}

// ── Lead Ad → intake ─────────────────────────────────────────────────────────

async function handleLeadAd(pageId: string, val: Record<string, unknown>) {
  const leadgenId = val.leadgen_id as string | undefined
  if (!leadgenId) return

  const sb = createAdminClient() as any

  // Find org + page token
  const { data: conn } = await sb
    .from('social_connections')
    .select('organization_id, branch_id, access_token')
    .eq('page_id', pageId)
    .eq('platform', 'facebook')
    .eq('is_active', true)
    .maybeSingle()

  if (!conn) return

  // Deduplicate
  const { data: existing } = await sb
    .from('intakes')
    .select('id')
    .eq('source_channel', 'facebook')
    .eq('external_id', leadgenId)
    .maybeSingle()
  if (existing) return

  // Fetch lead data from Meta Graph API
  const leadRes = await fetch(
    `https://graph.facebook.com/v21.0/${leadgenId}?fields=id,created_time,field_data,form_id&access_token=${conn.access_token}`,
  )
  if (!leadRes.ok) return

  const lead = await leadRes.json() as {
    id: string
    created_time: string
    form_id: string
    field_data: { name: string; values: string[] }[]
  }

  const fieldMap = Object.fromEntries(
    (lead.field_data ?? []).map((f) => [f.name.toLowerCase(), f.values?.[0] ?? ''])
  )

  const contactName  = fieldMap['full_name']  ?? fieldMap['nombre'] ?? fieldMap['name'] ?? null
  const contactPhone = fieldMap['phone_number'] ?? fieldMap['teléfono'] ?? fieldMap['telefono'] ?? fieldMap['phone'] ?? null
  const contactEmail = fieldMap['email']       ?? null
  const customFields = Object.entries(fieldMap)
    .filter(([k]) => !['full_name','nombre','name','phone_number','teléfono','telefono','phone','email'].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const rawContent = [
    contactName  && `Nombre: ${contactName}`,
    contactPhone && `Teléfono: ${contactPhone}`,
    contactEmail && `Email: ${contactEmail}`,
    customFields || null,
    `Formulario: ${lead.form_id}`,
  ].filter(Boolean).join('\n') || 'Lead de Facebook sin datos adicionales'

  // Resolve branch
  let branchId = conn.branch_id
  if (!branchId) {
    const { data: branch } = await sb
      .from('branches')
      .select('id')
      .eq('organization_id', conn.organization_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    branchId = branch?.id
  }
  if (!branchId) return

  await processIntake({
    organizationId: conn.organization_id,
    branchId,
    channel:        'facebook',
    externalId:     leadgenId,
    contactName:    contactName  ?? undefined,
    contactPhone:   contactPhone ?? undefined,
    contactEmail:   contactEmail ?? undefined,
    rawContent,
    metadata: {
      form_id:   lead.form_id,
      page_id:   pageId,
      leadgen_id: leadgenId,
      field_data: lead.field_data,
    },
  })
}
