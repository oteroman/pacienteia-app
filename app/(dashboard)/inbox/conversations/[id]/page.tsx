import Link                    from 'next/link'
import { notFound, redirect }  from 'next/navigation'
import { createClient }        from '@/lib/supabase/server'
import { getActiveOrganizationId } from '@/lib/tenant/context'
import {
  fetchConversation,
  fetchConversationMessages,
  type Message,
} from '@/lib/inbox/conversations'
import {
  resolveConversation,
  assignConversationToMe,
  markConversationRead,
} from '@/app/actions/conversations'
import { MessageComposer }     from './MessageComposer'

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

  await markConversationRead(id)

  const isResolved    = conversation.status === 'resolved'
  const resolveAction = resolveConversation.bind(null, id)
  const assignAction  = assignConversationToMe.bind(null, id)
  const displayName   = conversation.patientName ?? conversation.contactName ?? conversation.contactPhone
  const lastIntent    = conversation.lastIntent

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0 border-b pb-4">
        <Link href="/inbox" className="text-slate hover:text-slate text-sm">
          ← Bandeja
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-ink truncate">{displayName}</p>
            {lastIntent && lastIntent !== 'none' && lastIntent !== 'positive_response' && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${intentBadgeCls(lastIntent)}`}>
                {intentLabel(lastIntent)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate">
            {conversation.contactPhone} · {channelLabel(conversation.channel)}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!conversation.assignedTo && !isResolved && (
            <form action={assignAction}>
              <button type="submit" className="text-xs bg-[#F3F6F9] hover:bg-fog text-slate px-3 py-1.5 rounded-lg transition-colors">
                Asignarme
              </button>
            </form>
          )}
          {!isResolved && (
            <form action={resolveAction}>
              <button type="submit" className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                Resolver
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Patient link */}
      {conversation.patientId && (
        <Link
          href={`/patients/${conversation.patientId}`}
          className="text-xs text-brand-600 hover:underline mb-3 flex-shrink-0"
        >
          Ver ficha del paciente →
        </Link>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-slate">Sin mensajes aún.</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Composer */}
      {!isResolved ? (
        <div className="flex-shrink-0 border-t pt-4">
          <MessageComposer conversationId={id} />
          <p className="text-[10px] text-slate mt-2 text-center">
            Shift+Enter para nueva línea · Enter para enviar
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-slate py-4 flex-shrink-0 border-t">
          Conversación resuelta
        </p>
      )}

    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  const time = new Date(message.createdAt).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const showIntent =
    !isOutbound &&
    message.detectedIntent &&
    message.detectedIntent !== 'none' &&
    message.detectedIntent !== 'positive_response' &&
    message.detectedIntent !== 'general_inquiry'

  return (
    <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs
          ${isOutbound
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-white border border-fog text-ink rounded-bl-sm'
          }`}
      >
        {message.body && (
          <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
        )}
        {!message.body && message.mediaType !== 'text' && (
          <p className="italic text-xs opacity-70">[{message.mediaType}]</p>
        )}
        <p className={`text-[10px] mt-1 ${isOutbound ? 'text-white/60 text-right' : 'text-slate'}`}>
          {time}
          {isOutbound && (
            <span className="ml-1">
              {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </p>
      </div>
      {showIntent && (
        <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${intentTextCls(message.detectedIntent!)}`}>
          <span className="font-bold">{intentLabel(message.detectedIntent!)}</span>
          {message.intentSummary && <span className="text-slate">· {message.intentSummary}</span>}
        </div>
      )}
    </div>
  )
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    whatsapp:            'WhatsApp',
    facebook_messenger:  'Facebook Messenger',
    instagram:           'Instagram DM',
  }
  return labels[channel] ?? channel
}

function intentLabel(intent: string): string {
  const labels: Record<string, string> = {
    cancel_intent:       'Quiere cancelar',
    reschedule_intent:   'Quiere reagendar',
    price_inquiry:       'Pregunta de precio',
    dissatisfaction:     'Insatisfecho',
    medical_urgency:     'URGENCIA MÉDICA',
    appointment_request: 'Solicita cita',
    general_inquiry:     'Consulta general',
  }
  return labels[intent] ?? intent
}

function intentBadgeCls(intent: string): string {
  if (intent === 'medical_urgency' || intent === 'dissatisfaction') return 'bg-red-100 text-red-700'
  if (intent === 'cancel_intent')       return 'bg-orange-100 text-orange-700'
  if (intent === 'appointment_request') return 'bg-lima-100 text-lima-700'
  if (intent === 'price_inquiry')       return 'bg-blue-100 text-blue-700'
  return 'bg-[#F3F6F9] text-slate'
}

function intentTextCls(intent: string): string {
  if (intent === 'medical_urgency' || intent === 'dissatisfaction') return 'text-red-600'
  if (intent === 'cancel_intent')       return 'text-orange-600'
  if (intent === 'appointment_request') return 'text-lima-600'
  if (intent === 'price_inquiry')       return 'text-blue-600'
  return 'text-slate'
}
