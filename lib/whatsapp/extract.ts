// Extracts structured data from a Meta WhatsApp Cloud API payload.
// Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface ExtractedMessage {
  wamid: string
  contactPhone: string
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
    if (!msgs?.length) return null  // status update, not a message

    const msg     = msgs[0] as Record<string, unknown>
    const wamid   = msg.id as string
    const type    = (msg.type as string) ?? 'text'
    const contact = (value.contacts as unknown[])?.[0] as Record<string, unknown>
    const phone   = (contact?.wa_id as string) ?? null
    if (!phone || !wamid) return null

    const name = ((contact?.profile as Record<string, unknown>)?.name as string) ?? null

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
