import { notFound }         from 'next/navigation'
import Link                  from 'next/link'
import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { sendSalesWhatsApp } from '@/lib/platform/sales-send'

type Params = Promise<{ id: string }>

interface Message {
  id:        string
  direction: 'inbound' | 'outbound'
  body:      string
  sent_at:   string
}

interface Prospect {
  id:           string
  phone:        string
  contact_name: string | null
  clinic_name:  string | null
  monthly_apts: string | null
  pain_point:   string | null
  email:        string | null
  status:       string
  flow_step:    string
  created_at:   string
}

async function sendManualMessage(prospectId: string, phone: string, formData: FormData) {
  'use server'
  await requirePlatformAdmin()
  const body = (formData.get('body') as string ?? '').trim()
  if (!body) return
  await sendSalesWhatsApp(phone, body, prospectId)
  revalidatePath(`/platform/sales/conversations/${prospectId}`)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABEL: Record<string, string> = {
  new:            'Nuevo',
  qualifying:     'Calificando',
  demo_requested: 'Demo solicitada',
  converted:      'Convertido',
  disqualified:   'Descartado',
}

export default async function ConversationPage({ params }: { params: Params }) {
  const { id } = await params
  const sb = createAdminClient() as any

  const [{ data: prospect }, { data: rawMessages }] = await Promise.all([
    sb.from('sales_prospects')
      .select('id,phone,contact_name,clinic_name,monthly_apts,pain_point,email,status,flow_step,created_at')
      .eq('id', id)
      .single(),
    sb.from('sales_messages')
      .select('id,direction,body,sent_at')
      .eq('prospect_id', id)
      .order('sent_at', { ascending: true }),
  ])

  if (!prospect) notFound()

  const p        = prospect as Prospect
  const messages = (rawMessages ?? []) as Message[]
  const sendMsg  = sendManualMessage.bind(null, p.id, p.phone)

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">

      {/* Header */}
      <div className="flex items-center gap-4 py-4 border-b border-fog shrink-0">
        <Link href="/platform/sales" className="text-slate hover:text-slate text-sm">
          ← Volver
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-semibold truncate">
            {p.contact_name ?? p.phone}
          </p>
          <p className="text-xs text-slate">
            {p.phone}
            {p.clinic_name && ` · ${p.clinic_name}`}
          </p>
        </div>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${
          p.status === 'converted'      ? 'bg-green-50 text-green-700' :
          p.status === 'demo_requested' ? 'bg-amber-50 text-amber-700' :
          p.status === 'qualifying'     ? 'bg-brand-50 text-brand-700' :
          p.status === 'disqualified'   ? 'bg-mist text-slate' :
                                          'bg-[#EEF0F3] text-slate'
        }`}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      </div>

      {/* Prospect context bar */}
      <div className="flex gap-4 py-3 px-1 border-b border-fog/60 shrink-0 overflow-x-auto">
        {p.email && (
          <Chip label="Email" value={p.email} />
        )}
        {p.monthly_apts && (
          <Chip label="Volumen" value={p.monthly_apts} />
        )}
        {p.pain_point && (
          <Chip label="Dolor" value={p.pain_point} />
        )}
        <Chip label="Iniciado" value={fmtTime(p.created_at)} />
        {p.status === 'demo_requested' && (
          <Link
            href={`/platform/tenants/new?prospect=${p.id}`}
            className="ml-auto shrink-0 text-xs font-semibold text-lima-600 hover:text-green-300 border border-green-800 hover:border-green-600 px-3 py-1 rounded-lg transition-colors"
          >
            Convertir en cliente →
          </Link>
        )}
      </div>

      {/* Messages thread */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 px-1">
        {messages.length === 0 ? (
          <p className="text-center text-slate text-sm py-12">
            Sin mensajes registrados aún.
            <br />
            <span className="text-xs">Los mensajes futuros aparecerán aquí en tiempo real.</span>
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 space-y-1 ${
                msg.direction === 'outbound'
                  ? 'bg-brand-600 text-ink rounded-br-sm'
                  : 'bg-mist text-gray-100 rounded-bl-sm'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-snug">{msg.body}</p>
                <p className={`text-[10px] text-right ${
                  msg.direction === 'outbound' ? 'text-brand-200' : 'text-slate'
                }`}>
                  {fmtTime(msg.sent_at)}
                  {msg.direction === 'outbound' && ' · Paxi / Admin'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <form
        action={sendMsg}
        className="shrink-0 border-t border-fog pt-4 pb-2 flex gap-3 items-end"
      >
        <textarea
          name="body"
          rows={2}
          placeholder="Escribe un mensaje manual como Paxi…"
          className="flex-1 bg-mist border border-fog rounded-xl px-3 py-2.5 text-sm text-slate placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-ink text-sm font-semibold rounded-xl transition-colors shrink-0"
        >
          Enviar →
        </button>
      </form>
      <p className="text-[10px] text-slate pb-2">
        El mensaje se enviará desde el número de Paxi y quedará registrado en el historial.
      </p>
    </div>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0">
      <span className="text-[10px] text-slate uppercase tracking-wide block">{label}</span>
      <span className="text-xs text-slate">{value}</span>
    </div>
  )
}
