import { redirect }          from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { disconnectSocial }  from '@/app/actions/social'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pacienteia.com'

interface SocialConnection {
  platform:             string
  page_name:            string | null
  page_id:              string | null
  instagram_account_id: string | null
  is_active:            boolean
  connected_at:         string
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')

  const { connected, error } = await searchParams

  const sb = createAdminClient() as any
  const { data: connections } = await sb
    .from('social_connections')
    .select('platform, page_name, page_id, instagram_account_id, is_active, connected_at')
    .eq('organization_id', ctx.organizationId)

  const conns = (connections ?? []) as SocialConnection[]
  const fbConn  = conns.find((c) => c.platform === 'facebook')
  const ttConn  = conns.find((c) => c.platform === 'tiktok')

  const fbConnected = !!fbConn?.is_active
  const igConnected = fbConnected && !!fbConn?.instagram_account_id
  const ttConnected = !!ttConn?.is_active

  // Organization ID needed for TikTok and webhook setup
  const orgId = ctx.organizationId

  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Redes sociales</h1>
        <p className="text-sm text-slate mt-1">
          Conecta tus páginas para capturar consultas de anuncios y responder mensajes directos desde PacienteIA.
        </p>
      </div>

      {/* Toast messages */}
      {connected === 'facebook' && (
        <div className="rounded-xl border border-lima-200 bg-lima-50 px-5 py-3 text-sm text-lima-700 font-medium">
          ✓ Facebook e Instagram conectados correctamente.
        </div>
      )}
      {error === 'cancelled' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700">
          Conexión cancelada. Puedes intentarlo de nuevo cuando quieras.
        </div>
      )}
      {(error === 'no_pages' || error === 'token_exchange' || error === 'not_configured') && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error === 'not_configured'
            ? 'Integración no configurada. Contacta al equipo de PacienteIA para activarla.'
            : `Error al conectar: ${error === 'no_pages' ? 'no se encontró ninguna página de Facebook administrada por esta cuenta.' : 'fallo en el intercambio de tokens. Intenta de nuevo.'}`}
        </div>
      )}

      {/* ── Facebook Messenger ─────────────────────────────── */}
      <SocialCard
        logo="f"
        logoBg="bg-[#1877F2]"
        platform="Facebook Messenger"
        description="Los mensajes de tu Página de Facebook aparecen en la bandeja. Las consultas de tus anuncios ingresan automáticamente a tu bandeja."
        connected={fbConnected}
        connectedLabel={fbConn?.page_name ?? undefined}
        connectedAt={fbConn?.connected_at}
        connectHref="/api/auth/facebook"
        disconnectPlatform="facebook"
        orgId={orgId}
      />

      {/* ── Instagram DMs ──────────────────────────────────── */}
      <SocialCard
        logo="ig"
        logoBg="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400"
        platform="Instagram DMs"
        description="Los mensajes directos de tu cuenta de Instagram de negocio aparecen en la bandeja junto con WhatsApp y Messenger."
        connected={igConnected}
        connectedLabel={igConnected ? `Vinculado a ${fbConn?.page_name ?? 'tu página'}` : undefined}
        connectedAt={fbConn?.connected_at}
        note={!fbConnected ? 'Primero conecta tu Página de Facebook — Instagram se activa automáticamente.' : (!igConnected ? 'Tu página de Facebook no tiene una cuenta de Instagram de negocio vinculada.' : undefined)}
        connectHref={!fbConnected ? '/api/auth/facebook' : undefined}
        disconnectPlatform={igConnected ? 'facebook' : undefined}
        orgId={orgId}
        readOnly={fbConnected && !igConnected}
      />

      {/* ── TikTok Lead Gen ────────────────────────────────── */}
      <div className="rounded-2xl border border-fog bg-white p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-black">Tt</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-ink text-sm">TikTok Lead Gen</h2>
              {ttConnected ? (
                <span className="text-[10px] font-bold bg-lima-100 text-lima-700 px-2 py-0.5 rounded-full border border-lima-200">Activo</span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Configuración manual</span>
              )}
            </div>
            <p className="text-xs text-slate mt-1">
              Las consultas de tus campañas de TikTok Lead Generation ingresan automáticamente a tu bandeja. Requiere configurar el webhook en TikTok Ads Manager.
            </p>
          </div>
        </div>

        <div className="border border-fog rounded-xl bg-[#F8FAFC] p-4 space-y-3">
          <p className="text-xs font-semibold text-ink">Cómo configurarlo:</p>
          <ol className="text-xs text-slate space-y-1.5 list-decimal list-inside">
            <li>Ve a <strong>TikTok Ads Manager → Herramientas → Lead Generation → Webhooks</strong></li>
            <li>Crea un nuevo webhook con la URL:</li>
          </ol>
          <div className="font-mono text-xs bg-white border border-fog rounded-lg px-3 py-2 break-all select-all">
            {APP_URL}/api/intake/tiktok
          </div>
          <ol className="text-xs text-slate space-y-1.5 list-decimal list-inside" start={3}>
            <li>En cada formulario de lead, agrega un campo oculto <code className="font-mono bg-white border border-fog rounded px-1">clinic_id</code> con el valor:</li>
          </ol>
          <div className="font-mono text-xs bg-white border border-fog rounded-lg px-3 py-2 break-all select-all">
            {orgId}
          </div>
        </div>
      </div>

      {/* ── Webhook setup note for FB ──────────────────────── */}
      {fbConnected && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-xs text-brand-800 space-y-2">
          <p className="font-semibold">Configura el webhook en Meta Developer Console</p>
          <p>Para recibir mensajes en tiempo real, suscribe tu app Meta a los eventos de tu página:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Ve a <strong>developers.facebook.com → Tu App → Webhooks</strong></li>
            <li>Webhook URL: <code className="font-mono bg-white/60 px-1 rounded">{APP_URL}/api/facebook/webhook</code></li>
            <li>Verify Token: el valor de tu variable <code className="font-mono bg-white/60 px-1 rounded">FACEBOOK_WEBHOOK_VERIFY_TOKEN</code></li>
            <li>Suscribe a: <code className="font-mono bg-white/60 px-1 rounded">messages</code>, <code className="font-mono bg-white/60 px-1 rounded">messaging_postbacks</code>, <code className="font-mono bg-white/60 px-1 rounded">leadgen</code></li>
          </ol>
        </div>
      )}
    </div>
  )
}

// ── Reusable card component ────────────────────────────────────────────────

function SocialCard({
  logo, logoBg, platform, description, connected, connectedLabel,
  connectedAt, connectHref, disconnectPlatform, orgId, note, readOnly,
}: {
  logo: string
  logoBg: string
  platform: string
  description: string
  connected: boolean
  connectedLabel?: string
  connectedAt?: string
  connectHref?: string
  disconnectPlatform?: string
  orgId: string
  note?: string
  readOnly?: boolean
}) {
  const connectedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className={`rounded-2xl border bg-white p-6 space-y-4 ${connected ? 'border-lima-300 ring-1 ring-lima-100' : 'border-fog'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl ${logoBg} flex items-center justify-center flex-shrink-0`}>
          {logo === 'f' && (
            <span className="text-white font-black text-base">f</span>
          )}
          {logo === 'ig' && (
            <span className="text-white font-bold text-xs">IG</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-ink text-sm">{platform}</h2>
            {connected ? (
              <span className="text-[10px] font-bold bg-lima-100 text-lima-700 px-2 py-0.5 rounded-full border border-lima-200">
                Conectado
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-[#F3F6F9] text-slate px-2 py-0.5 rounded-full border border-fog">
                No conectado
              </span>
            )}
          </div>
          <p className="text-xs text-slate mt-1">{description}</p>
          {connected && connectedLabel && (
            <p className="text-xs text-lima-700 mt-1 font-medium">
              {connectedLabel}{connectedDate ? ` · conectado el ${connectedDate}` : ''}
            </p>
          )}
          {note && !connected && (
            <p className="text-xs text-amber-600 mt-1">{note}</p>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          {!connected && connectHref && (
            <a
              href={connectHref}
              className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Conectar →
            </a>
          )}
          {connected && disconnectPlatform && (
            <form action={disconnectSocial.bind(null, disconnectPlatform, orgId)}>
              <button
                type="submit"
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
                onClick={(e) => { if (!confirm('¿Desconectar esta red social?')) e.preventDefault() }}
              >
                Desconectar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
