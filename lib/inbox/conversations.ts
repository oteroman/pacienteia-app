import { createClient } from '@/lib/supabase/server'

export interface Conversation {
  id: string
  channel: string
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
  lastIntent: string | null
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
  detectedIntent: string | null
  intentSummary: string | null
}

export async function fetchConversations(
  organizationId: string,
  branchId: string | null
): Promise<Conversation[]> {
  const sb = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb as any)
    .from('conversations')
    .select('id, channel, contact_phone, contact_name, patient_id, status, lead_heat, unread_count, last_message_at, last_message_preview, assigned_to, last_intent')
    .eq('organization_id', organizationId)
    .neq('status', 'resolved')
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data } = await query
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    channel: (r.channel as string) ?? 'whatsapp',
    contactPhone: r.contact_phone as string,
    contactName: r.contact_name as string | null,
    patientId: r.patient_id as string | null,
    patientName: null,
    status: r.status as Conversation['status'],
    leadHeat: r.lead_heat as Conversation['leadHeat'],
    unreadCount: r.unread_count as number,
    lastMessageAt: r.last_message_at as string | null,
    lastMessagePreview: r.last_message_preview as string | null,
    assignedTo: r.assigned_to as string | null,
    lastIntent: r.last_intent as string | null,
  }))
}

export async function fetchConversation(
  organizationId: string,
  conversationId: string
): Promise<Conversation | null> {
  const sb = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('conversations')
    .select('id, channel, contact_phone, contact_name, patient_id, status, lead_heat, unread_count, last_message_at, last_message_preview, assigned_to, last_intent')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single()

  if (error) console.error('[fetchConversation] error', error)
  if (!data) return null
  return {
    id: data.id,
    channel: (data.channel as string) ?? 'whatsapp',
    contactPhone: data.contact_phone,
    contactName: data.contact_name,
    patientId: data.patient_id,
    patientName: null,
    status: data.status as Conversation['status'],
    leadHeat: data.lead_heat as Conversation['leadHeat'],
    unreadCount: data.unread_count,
    lastMessageAt: data.last_message_at,
    lastMessagePreview: data.last_message_preview,
    assignedTo: data.assigned_to,
    lastIntent: data.last_intent as string | null,
  }
}

export async function fetchConversationMessages(
  organizationId: string,
  conversationId: string
): Promise<Message[]> {
  const sb = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from('messages')
    .select('id, direction, body, media_type, media_url, status, sent_by, created_at, detected_intent, intent_summary')
    .eq('conversation_id', conversationId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(100)

  return ((data ?? []) as Record<string, unknown>[]).map((m) => ({
    id: m.id as string,
    direction: m.direction as 'inbound' | 'outbound',
    body: m.body as string | null,
    mediaType: (m.media_type as string) ?? 'text',
    mediaUrl: m.media_url as string | null,
    status: m.status as string,
    sentBy: m.sent_by as string | null,
    createdAt: m.created_at as string,
    detectedIntent: m.detected_intent as string | null,
    intentSummary: m.intent_summary as string | null,
  }))
}
