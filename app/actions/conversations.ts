'use server'

import { revalidatePath }             from 'next/cache'
import { createAdminClient }          from '@/lib/supabase/admin'
import { createClient }               from '@/lib/supabase/server'
import { sendWhatsAppText }           from '@/lib/whatsapp/send'
import { sendFacebookMessage, sendInstagramMessage } from '@/lib/social/send'
import { getActiveOrganizationId }    from '@/lib/tenant/context'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (sb as any)
    .from('conversations')
    .select('channel, contact_phone, branch_id')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single()

  if (!conv) return { ok: false, error: 'Conversación no encontrada' }

  const channel: string = conv.channel ?? 'whatsapp'
  let messageId: string | null = null

  if (channel === 'facebook_messenger') {
    const result = await sendFacebookMessage({
      organizationId,
      recipientId: conv.contact_phone,
      body,
    })
    if (result.error) return { ok: false, error: result.error }
    messageId = result.messageId
  } else if (channel === 'instagram') {
    const result = await sendInstagramMessage({
      organizationId,
      recipientId: conv.contact_phone,
      body,
    })
    if (result.error) return { ok: false, error: result.error }
    messageId = result.messageId
  } else {
    const result = await sendWhatsAppText({
      branchId: conv.branch_id,
      to: conv.contact_phone,
      body,
    })
    if (result.error) return { ok: false, error: result.error }
    messageId = result.wamid
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('messages').insert({
    conversation_id: conversationId,
    organization_id: organizationId,
    wamid:           messageId,
    direction:       'outbound',
    body,
    media_type:      'text',
    status:          'sent',
    sent_by:         user.id,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any)
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
}

export async function assignConversationToMe(conversationId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any)
    .from('conversations')
    .update({ assigned_to: user.id, status: 'assigned' })
    .eq('id', conversationId)
    .eq('organization_id', organizationId)

  revalidatePath('/inbox')
  revalidatePath(`/inbox/conversations/${conversationId}`)
}
