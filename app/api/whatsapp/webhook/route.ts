import { NextRequest, NextResponse }  from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient }           from '@/lib/supabase/admin'
import { decryptToken }                from '@/lib/crypto/whatsapp-token'
import { extractInboundMessage }       from '@/lib/whatsapp/extract'
import { handleReminderReply }         from '@/lib/whatsapp/reminder-reply'
import { handleRescheduleSelection }   from '@/lib/whatsapp/reschedule'
import { handleFollowupReply }         from '@/lib/whatsapp/followup-reply'
import { handleReactivationReply }     from '@/lib/whatsapp/reactivation-reply'
import { handleBackfillReply }                    from '@/lib/whatsapp/backfill-reply'
import { handleFlashOfferReply }                  from '@/lib/whatsapp/flash-offer-reply'
import { runNluPipeline }                         from '@/lib/whatsapp/nlu'
import { handleBookingFlow }                      from '@/lib/whatsapp/booking-flow'
import { isStaffPhone, handleStaffVoiceNote }     from '@/lib/voice/handle-staff-voice'
import { parseStaffTextCommand }                   from '@/lib/voice/parse-staff-text'
import { sendWhatsAppText }                        from '@/lib/whatsapp/send'
import { isWaitingRoomTrigger, handleWaitingRoomEntry } from '@/lib/whatsapp/waiting-room'

// GET /api/whatsapp/webhook
// Meta verification handshake — responds with hub.challenge on success.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

// POST /api/whatsapp/webhook
// Receives WhatsApp Cloud API events from Meta.
//
// HMAC validation is per-clinic: each clinic has their own Meta app with
// their own App Secret, stored encrypted in branch_whatsapp_config.app_secret_enc.
// Falls back to the global WHATSAPP_APP_SECRET env var for branches that
// haven't configured their own secret yet (backward compatibility).
export async function POST(req: NextRequest) {
  const rawBody   = await req.text()
  const signature = req.headers.get('x-hub-signature-256') ?? ''

  // Parse payload first to extract phone_number_id for per-clinic secret lookup.
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse(null, { status: 200 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return new NextResponse(null, { status: 200 })
  }

  const phoneNumberId = extractPhoneNumberId(payload)
  const eventId       = extractEventId(payload)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Look up branch config to resolve the correct App Secret for HMAC validation.
  const { data: config } = await sb
    .from('branch_whatsapp_config')
    .select('branch_id, organization_id, app_secret_enc')
    .eq('phone_number_id', phoneNumberId ?? '')
    .eq('status', 'active')
    .maybeSingle()

  const appSecret = resolveAppSecret(config?.app_secret_enc)
  if (!appSecret || !isSignatureValid(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!config) {
    console.warn('[wa-webhook] no active branch for phone_number_id', { phoneNumberId, eventId })
    return new NextResponse(null, { status: 200 })
  }

  await sb.from('webhook_queue').insert({
    organization_id: config.organization_id,
    branch_id:       config.branch_id,
    phone_number_id: phoneNumberId,
    source:          'whatsapp',
    payload,
  })

  const extracted = extractInboundMessage(payload)
  if (extracted) {
    // ── Staff voice note — intercept before patient flow ───────────────────
    if (extracted.mediaType === 'audio' && extracted.mediaUrl) {
      const staffDetected = await isStaffPhone(sb, config.organization_id, extracted.contactPhone)
      if (staffDetected) {
        handleStaffVoiceNote({
          organizationId: config.organization_id,
          branchId:       config.branch_id,
          staffPhone:     extracted.contactPhone,
          mediaId:        extracted.mediaUrl,
        }).catch((err) => console.error('[voice]', err))
        return new NextResponse(null, { status: 200 })
      }
    }

    const { data: conv } = await sb
      .from('conversations')
      .upsert({
        organization_id:      config.organization_id,
        branch_id:            config.branch_id,
        contact_phone:        extracted.contactPhone,
        contact_name:         extracted.contactName,
        channel:              'whatsapp',
        status:               'open',
        last_message_at:      new Date().toISOString(),
        last_message_preview: extracted.body?.slice(0, 120) ?? '[media]',
        updated_at:           new Date().toISOString(),
      }, {
        onConflict: 'organization_id,branch_id,contact_phone,channel',
        ignoreDuplicates: false,
      })
      .select('id')
      .single()

    let messageId: string | null = null
    if (conv?.id) {
      await sb.rpc('increment_unread', { p_conversation_id: conv.id })
      const { data: msgRow } = await sb.from('messages').upsert({
        conversation_id: conv.id,
        organization_id: config.organization_id,
        wamid:           extracted.wamid,
        direction:       'inbound',
        body:            extracted.body,
        media_type:      extracted.mediaType,
        media_url:       extracted.mediaUrl,
        status:          'received',
      }, { onConflict: 'wamid', ignoreDuplicates: true }).select('id').single()
      messageId = msgRow?.id ?? null
    }

    if (extracted.body && extracted.mediaType === 'text') {
      // Staff text command — intercept before patient flows
      const isStaffText = await isStaffPhone(sb, config.organization_id, extracted.contactPhone)
      if (isStaffText) {
        const parsed = await parseStaffTextCommand(
          extracted.body,
          config.organization_id,
          config.branch_id,
        )

        // Build pre-filled appointment URL if it's an appointment request
        let bookingUrl: string | null = null
        if (parsed.isAppointmentRequest) {
          const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.pacienteia.com'
          const params = new URLSearchParams()
          if (parsed.patientId)      params.set('patient_id',      parsed.patientId)
          if (parsed.professionalId) params.set('professional_id', parsed.professionalId)
          if (parsed.date)           params.set('date',            parsed.date)
          if (parsed.time)           params.set('time',            parsed.time)
          bookingUrl = `${base}/appointments/new?${params.toString()}`
        }

        const lines: string[] = [`**Instrucción de staff:**\n${extracted.body}`]
        if (parsed.patientName)      lines.push(`👤 Paciente: ${parsed.patientName}${parsed.patientId ? ' ✓' : ' ⚠️ no encontrado'}`)
        if (parsed.professionalName) lines.push(`👨‍⚕️ Profesional: ${parsed.professionalName}${parsed.professionalId ? ' ✓' : ' ⚠️ no encontrado'}`)
        if (parsed.date)             lines.push(`📅 Fecha: ${parsed.date}${parsed.time ? ` a las ${parsed.time}` : ''}`)
        if (parsed.serviceHint)      lines.push(`💉 Servicio: ${parsed.serviceHint}`)
        if (bookingUrl)              lines.push(`\n👉 **Agendar cita:** ${bookingUrl}`)

        await sb.from('copilot_tasks').insert({
          organization_id: config.organization_id,
          branch_id:       config.branch_id,
          patient_id:      parsed.patientId ?? null,
          title:           parsed.isAppointmentRequest
            ? `📅 Cita: ${parsed.patientName ?? 'paciente'} — ${parsed.date ?? 'fecha pendiente'}`
            : `📝 Staff: ${extracted.body.slice(0, 80)}`,
          description:     lines.join('\n'),
          priority:        parsed.isAppointmentRequest ? 'high' : 'medium',
          status:          'open',
          source:          'whatsapp_staff',
        })

        const reply = parsed.isAppointmentRequest && bookingUrl
          ? `✅ Entendido. Tarea creada para agendar cita de ${parsed.patientName ?? 'paciente'} el ${parsed.date ?? 'fecha indicada'}.\n\n👉 Agendar: ${bookingUrl}`
          : '✅ Instrucción recibida. Tarea creada en el copiloto.'

        await sendWhatsAppText({
          branchId: config.branch_id,
          to:       extracted.contactPhone,
          body:     reply,
        })
        return new NextResponse(null, { status: 200 })
      }

      const bookingHandled = await handleBookingFlow({
        organizationId: config.organization_id,
        branchId:       config.branch_id,
        contactPhone:   extracted.contactPhone,
        body:           extracted.body,
      })
      if (bookingHandled) {
        return new NextResponse(null, { status: 200 })
      }

      // Waiting room — patient scans QR, sends "Sala de espera"
      if (isWaitingRoomTrigger(extracted.body)) {
        handleWaitingRoomEntry({
          organizationId: config.organization_id,
          branchId:       config.branch_id,
          contactPhone:   extracted.contactPhone,
          contactName:    extracted.contactName ?? null,
        }).catch(err => console.error('[waiting-room]', err))
        return new NextResponse(null, { status: 200 })
      }

      const rescheduleHandled = await handleRescheduleSelection({
        sb,
        organizationId: config.organization_id,
        branchId:       config.branch_id,
        contactPhone:   extracted.contactPhone,
        body:           extracted.body,
      })

      if (!rescheduleHandled) {
        await handleReminderReply({
          sb,
          organizationId: config.organization_id,
          branchId:       config.branch_id,
          contactPhone:   extracted.contactPhone,
          body:           extracted.body,
        })
      }

      await handleFollowupReply({
        organizationId: config.organization_id,
        branchId:       config.branch_id,
        contactPhone:   extracted.contactPhone,
        body:           extracted.body,
      })
      await handleReactivationReply({
        organizationId: config.organization_id,
        branchId:       config.branch_id,
        contactPhone:   extracted.contactPhone,
        body:           extracted.body,
      })
      await handleBackfillReply({
        organizationId: config.organization_id,
        branchId:       config.branch_id,
        contactPhone:   extracted.contactPhone,
        body:           extracted.body,
      })
      await handleFlashOfferReply({
        organizationId: config.organization_id,
        branchId:       config.branch_id,
        contactPhone:   extracted.contactPhone,
        body:           extracted.body,
      })

      if (conv?.id && messageId) {
        runNluPipeline({
          organizationId: config.organization_id,
          branchId:       config.branch_id,
          conversationId: conv.id,
          messageId,
          contactPhone:   extracted.contactPhone,
          contactName:    extracted.contactName ?? null,
          body:           extracted.body,
        }).catch((err) => console.error('[nlu]', err))
      }
    }
  }

  return new NextResponse(null, { status: 200 })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Per-clinic App Secret takes priority over the global env var.
// Falls back to WHATSAPP_APP_SECRET for branches configured before per-clinic
// secrets were introduced (backward compatibility).
function resolveAppSecret(encryptedSecret?: string | null): string {
  if (encryptedSecret) {
    try {
      return decryptToken(encryptedSecret)
    } catch {
      console.error('[wa-webhook] failed to decrypt per-clinic app_secret — falling back to global')
    }
  }
  return process.env.WHATSAPP_APP_SECRET ?? ''
}

function isSignatureValid(rawBody: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) return false
  const expected = signature.slice(7)
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'))
  } catch {
    return false
  }
}

function extractPhoneNumberId(payload: Record<string, unknown>): string | null {
  try {
    const entry  = (payload.entry  as unknown[])?.[0] as Record<string, unknown>
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
    const value  = change?.value   as Record<string, unknown>
    const meta   = value?.metadata as Record<string, unknown>
    return typeof meta?.phone_number_id === 'string' ? meta.phone_number_id : null
  } catch {
    return null
  }
}

function extractEventId(payload: Record<string, unknown>): string | null {
  try {
    const entry    = (payload.entry    as unknown[])?.[0] as Record<string, unknown>
    const change   = (entry?.changes   as unknown[])?.[0] as Record<string, unknown>
    const value    = change?.value     as Record<string, unknown>
    const messages = value?.messages   as { id?: string }[] | undefined
    const statuses = value?.statuses   as { id?: string }[] | undefined
    return messages?.[0]?.id ?? statuses?.[0]?.id ?? null
  } catch {
    return null
  }
}
