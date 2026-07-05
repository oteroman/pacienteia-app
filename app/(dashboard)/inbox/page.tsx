import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import { fetchInbox, CHANNEL_LABELS, CHANNEL_COLORS } from '@/lib/intake/index'
import type { Intake } from '@/lib/intake/index'
import { getSlaStatus } from '@/lib/intake/orchestrate'
import {
  fetchConversations, fetchConversation, fetchConversationMessages,
  type Conversation, type Message,
} from '@/lib/inbox/conversations'
import { InboxRealtime }  from './InboxRealtime'
import { ScrollToBottom } from './ScrollToBottom'
import { resolveConversation, assignConversationToMe, markConversationRead } from '@/app/actions/conversations'
import { MessageComposer } from './conversations/[id]/MessageComposer'

type FilterKey = 'all' | 'urgent' | 'cancel' | 'appointment' | 'price'

const FILTER_INTENTS: Record<FilterKey, string[]> = {
  all:         [],
  urgent:      ['medical_urgency', 'dissatisfaction'],
  cancel:      ['cancel_intent'],
  appointment: ['appointment_request'],
  price:       ['price_inquiry'],
}

const FILTER_LABELS: Record<FilterKey, string> = {
  all:         'Todos',
  urgent:      'Urgentes',
  cancel:      'Cancelan',
  appointment: 'Citas',
  price:       'Precios',
}

type SearchParams = Promise<{ conv?: string; filter?: string }>

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const { conv: selectedConvId, filter: filterParam } = await searchParams
  const activeFilter = (Object.keys(FILTER_INTENTS).includes(filterParam ?? '') ? filterParam : 'all') as FilterKey

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const organizationId = await getActiveOrganizationId()
  const branchId = await getActiveBranchId()

  const [active, conversations] = await Promise.all([
    fetchInbox(clinicId),
    organizationId ? fetchConversations(organizationId, branchId) : Promise.resolve([]),
  ])

  let selectedConv: Conversation | null = null
  let messages: Message[] = []
  if (selectedConvId && organizationId) {
    ;[selectedConv, messages] = await Promise.all([
      fetchConversation(organizationId, selectedConvId),
      fetchConversationMessages(organizationId, selectedConvId),
    ])
    if (selectedConv) await markConversationRead(selectedConvId)
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  const intentsForFilter = FILTER_INTENTS[activeFilter]
  const filteredConversations = intentsForFilter.length === 0
    ? conversations
    : conversations.filter((c) => c.lastIntent && intentsForFilter.includes(c.lastIntent))

  const backHref = activeFilter !== 'all' ? `/inbox?filter=${activeFilter}` : '/inbox'

  return (
    <div
      className="-mt-8 -mb-8 -mx-4 sm:-mx-6 lg:-mx-8 flex border-t border-fog bg-white"
      style={{ height: 'calc(100dvh - 4rem)' }}
    >
      {organizationId && <InboxRealtime organizationId={organizationId} />}

      {/* ── LEFT PANEL — full screen on mobile when no conv selected ── */}
      <div className={`flex-col overflow-hidden border-r border-fog
        ${selectedConvId ? 'hidden lg:flex lg:w-80 lg:flex-shrink-0' : 'flex w-full lg:w-80 lg:flex-shrink-0'}`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-fog flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-bold text-ink">Bandeja</h1>
            {totalUnread > 0 && (
              <p className="text-[10px] text-lima-600 font-medium">{totalUnread} sin leer</p>
            )}
          </div>
          <Link
            href="/inbox/new"
            className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-700 transition-colors"
          >
            + Nuevo
          </Link>
        </div>

        {/* Intent filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-fog overflow-x-auto flex-shrink-0 scrollbar-none">
          {(Object.keys(FILTER_INTENTS) as FilterKey[]).map((key) => {
            const isActive = activeFilter === key
            const convUrl  = selectedConvId ? `?conv=${selectedConvId}&filter=${key}` : `?filter=${key}`
            return (
              <Link
                key={key}
                href={convUrl}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 transition-colors ${
                  isActive
                    ? key === 'urgent'      ? 'bg-red-600 text-white'
                    : key === 'cancel'      ? 'bg-orange-500 text-white'
                    : key === 'appointment' ? 'bg-green-600 text-white'
                    : key === 'price'       ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-white'
                    : 'bg-[#F3F6F9] text-slate hover:bg-fog'
                }`}
              >
                {FILTER_LABELS[key]}
              </Link>
            )
          })}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">

          {/* WhatsApp conversations */}
          {filteredConversations.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-lima-500 inline-block" />
                WhatsApp
                {activeFilter !== 'all' && (
                  <span className="text-[9px] text-fog">— {filteredConversations.length} resultado{filteredConversations.length !== 1 ? 's' : ''}</span>
                )}
              </p>
              {filteredConversations.map((conv) => (
                <ConvListItem key={conv.id} conv={conv} isSelected={conv.id === selectedConvId} filter={activeFilter} />
              ))}
            </div>
          )}
          {activeFilter !== 'all' && filteredConversations.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-slate">Sin conversaciones con este filtro</p>
            </div>
          )}

          {/* Intakes / Leads */}
          {active.length > 0 && (
            <div>
              <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-slate uppercase tracking-wide">
                Leads & Formularios
              </p>
              {active.map((intake) => (
                <IntakeListItem key={intake.id} intake={intake} />
              ))}
            </div>
          )}

          {conversations.length === 0 && active.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-xs text-slate">La bandeja está vacía</p>
              <Link href="/inbox/new" className="text-xs text-brand-600 hover:underline mt-2 block">
                Registrar entrada →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — full screen on mobile when conv selected ── */}
      <div className={`flex-col overflow-hidden bg-[#f0f2f5]
        ${selectedConvId ? 'flex flex-1' : 'hidden lg:flex lg:flex-1'}`}
      >
        {selectedConv ? (
          <ChatPane conversation={selectedConv} messages={messages} backHref={backHref} />
        ) : (
          <EmptyPane hasItems={conversations.length + active.length > 0} />
        )}
      </div>
    </div>
  )
}

// ── Left panel items ──────────────────────────────────────────

function ConvListItem({ conv, isSelected, filter }: { conv: Conversation; isSelected: boolean; filter?: string }) {
  const name = conv.patientName ?? conv.contactName ?? conv.contactPhone
  const time = conv.lastMessageAt ? formatTimeAgo(conv.lastMessageAt) : ''
  const bold = conv.unreadCount > 0
  const href = filter && filter !== 'all' ? `?conv=${conv.id}&filter=${filter}` : `?conv=${conv.id}`

  return (
    <Link
      href={href}
      className={`block px-4 py-3 border-b border-fog hover:bg-mist transition-colors
        ${isSelected ? 'bg-brand-50 border-l-[3px] border-l-brand-500' : 'border-l-[3px] border-l-transparent'}`}
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-lima-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-lima-700 text-xs font-bold">{(name[0] ?? '?').toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className={`text-sm truncate ${bold ? 'font-bold text-ink' : 'font-medium text-slate'}`}>
              {name}
            </p>
            <span className="text-[10px] text-slate flex-shrink-0 ml-2">{time}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className={`text-xs truncate flex-1 ${bold ? 'text-slate' : 'text-slate'}`}>
              {conv.lastMessagePreview ?? '...'}
            </p>
            {conv.lastIntent && conv.lastIntent !== 'none' && conv.lastIntent !== 'positive_response' && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${intentBadgeCls(conv.lastIntent)}`}>
                {intentLabel(conv.lastIntent)}
              </span>
            )}
          </div>
        </div>
        {conv.unreadCount > 0 && (
          <span className="mt-1 flex-shrink-0 text-[10px] font-bold text-white bg-lima-500 rounded-full w-4 h-4 flex items-center justify-center">
            {conv.unreadCount}
          </span>
        )}
      </div>
    </Link>
  )
}

function intentLabel(intent: string): string {
  const labels: Record<string, string> = {
    cancel_intent:       'Cancela',
    reschedule_intent:   'Reagenda',
    price_inquiry:       'Precio',
    dissatisfaction:     'Queja',
    medical_urgency:     'URGENTE',
    appointment_request: 'Cita',
    general_inquiry:     'Info',
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

function IntakeListItem({ intake }: { intake: Intake }) {
  const name    = intake.contactName ?? 'Sin nombre'
  const snippet = intake.normalizedSummary ?? intake.rawContent.slice(0, 70)
  const time    = formatTimeAgo(intake.createdAt)
  const sla     = getSlaStatus(intake.slaDueAt)

  return (
    <Link
      href={`/inbox/${intake.id}`}
      className="block px-4 py-3 border-b border-fog hover:bg-mist transition-colors border-l-[3px] border-l-transparent"
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-[#F3F6F9] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-slate text-xs font-bold">{(name[0] ?? '?').toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-sm font-medium text-slate truncate">{name}</p>
            <span className="text-[10px] text-slate flex-shrink-0 ml-2">{time}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${CHANNEL_COLORS[intake.sourceChannel]}`}>
              {CHANNEL_LABELS[intake.sourceChannel]}
            </span>
            <p className="text-xs text-slate truncate">{snippet}</p>
          </div>
        </div>
        {sla?.overdue && (
          <span className="mt-1 flex-shrink-0 text-[9px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">
            SLA
          </span>
        )}
      </div>
    </Link>
  )
}

// ── Right panel ───────────────────────────────────────────────

function EmptyPane({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3">💬</p>
        <p className="text-sm font-medium text-slate">
          {hasItems ? 'Selecciona una conversación' : 'La bandeja está vacía'}
        </p>
        <p className="text-xs text-slate mt-1">
          {hasItems
            ? 'Elige un contacto de la lista para ver el hilo'
            : 'Los mensajes de WhatsApp aparecerán aquí automáticamente'}
        </p>
      </div>
    </div>
  )
}

function ChatPane({ conversation, messages, backHref }: { conversation: Conversation; messages: Message[]; backHref: string }) {
  const isResolved  = conversation.status === 'resolved'
  const displayName = conversation.patientName ?? conversation.contactName ?? conversation.contactPhone
  const resolveAction = resolveConversation.bind(null, conversation.id)
  const assignAction  = assignConversationToMe.bind(null, conversation.id)

  return (
    <>
      {/* Chat header */}
      <div className="flex-shrink-0 bg-white border-b border-fog px-3 py-2.5 flex items-center gap-2">
        {/* Back button — mobile only */}
        <Link href={backHref} className="lg:hidden flex-shrink-0 p-1.5 -ml-1 text-brand-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="w-9 h-9 rounded-full bg-lima-100 flex items-center justify-center flex-shrink-0">
          <span className="text-lima-700 text-sm font-bold">
            {(displayName[0] ?? '?').toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-ink truncate">{displayName}</p>
          <p className="text-xs text-slate">{conversation.contactPhone}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {conversation.patientId && (
            <Link
              href={`/patients/${conversation.patientId}`}
              className="text-xs text-brand-600 hover:underline hidden lg:block"
            >
              Ver paciente →
            </Link>
          )}
          {!conversation.assignedTo && !isResolved && (
            <form action={assignAction}>
              <button type="submit" className="text-xs bg-[#F3F6F9] hover:bg-fog text-slate px-2.5 py-1.5 rounded-lg transition-colors">
                Asignarme
              </button>
            </form>
          )}
          {!isResolved && (
            <form action={resolveAction}>
              <button type="submit" className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                Resolver
              </button>
            </form>
          )}
          {isResolved && (
            <span className="text-xs text-slate px-2 py-1.5">Resuelta</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col-reverse px-3 py-3 gap-1.5">
        <ScrollToBottom convId={conversation.id} />
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-slate">Sin mensajes aún.</p>
          </div>
        ) : (
          [...messages].reverse().map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Composer */}
      {!isResolved ? (
        <div className="flex-shrink-0 bg-[#f0f2f5] px-3 py-2.5 border-t border-fog">
          <MessageComposer conversationId={conversation.id} />
        </div>
      ) : (
        <div className="flex-shrink-0 bg-white border-t border-fog px-4 py-3 text-center">
          <p className="text-xs text-slate">Conversación resuelta</p>
        </div>
      )}
    </>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  const time = new Date(message.createdAt).toLocaleTimeString('es-PE', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs
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
              {message.status === 'read' || message.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function formatTimeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}
