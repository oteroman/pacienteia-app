import Link                            from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient }         from '@/lib/supabase/admin'
import { requirePlatformAdmin }      from '@/lib/platform/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pacienteia.com'

interface TenantConn {
  org_id:               string
  org_name:             string
  platform:             string
  page_name:            string | null
  instagram_account_id: string | null
  is_active:            boolean
  connected_at:         string
}

interface PlatformConn {
  platform:             string
  page_name:            string | null
  page_id:              string | null
  instagram_account_id: string | null
  connected_at:         string
}

interface SocialLead {
  source_channel: string
  count: number
}

export default async function PlatformSocialPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  noStore()
  await requirePlatformAdmin()

  const { connected, error } = await searchParams
  const sb = createAdminClient() as any

  // PacienteIA's own platform connection
  const { data: platformConn } = await sb
    .from('platform_social_config')
    .select('platform, page_name, page_id, instagram_account_id, connected_at')
    .eq('platform', 'facebook')
    .maybeSingle() as { data: PlatformConn | null }

  // All tenant connections
  const { data: rawConns } = await sb
    .from('social_connections')
    .select('organization_id, platform, page_name, instagram_account_id, is_active, connected_at, organizations(name)')
    .order('connected_at', { ascending: false })

  const tenantConns: TenantConn[] = ((rawConns ?? []) as any[]).map((r) => ({
    org_id:               r.organization_id,
    org_name:             r.organizations?.name ?? r.organization_id,
    platform:             r.platform,
    page_name:            r.page_name,
    instagram_account_id: r.instagram_account_id,
    is_active:            r.is_active,
    connected_at:         r.connected_at,
  }))

  // Social leads last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rawLeads } = await sb
    .from('intakes')
    .select('source_channel')
    .in('source_channel', ['facebook', 'instagram', 'tiktok'])
    .gte('created_at', since)

  const leadCounts: Record<string, number> = {}
  for (const row of (rawLeads ?? []) as { source_channel: string }[]) {
    leadCounts[row.source_channel] = (leadCounts[row.source_channel] ?? 0) + 1
  }

  const totalSocialLeads = Object.values(leadCounts).reduce((s, n) => s + n, 0)

  const fbActive  = tenantConns.filter((c) => c.platform === 'facebook' && c.is_active).length
  const igActive  = tenantConns.filter((c) => c.platform === 'facebook' && c.instagram_account_id && c.is_active).length

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Redes Sociales</h1>
        <p className="text-sm text-slate mt-1">
          Conexión de la página de PacienteIA + estado de conexiones de clientes.
        </p>
      </div>

      {/* Toasts */}
      {connected === 'facebook' && (
        <div className="rounded-xl border border-lima-200 bg-lima-50 px-5 py-3 text-sm text-lima-700 font-medium">
          ✓ Página de PacienteIA conectada a Facebook e Instagram.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          Error: {error === 'no_pages' ? 'No se encontró ninguna página administrada.' : error === 'token_exchange' ? 'Fallo en intercambio de tokens.' : 'Cancelado.'}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Clientes con Facebook" value={fbActive} />
        <KpiCard label="Clientes con Instagram" value={igActive} />
        <KpiCard label="Leads sociales (30d)" value={totalSocialLeads} accent />
        <KpiCard label="FB leads (30d)" value={leadCounts['facebook'] ?? 0} />
      </div>

      {/* ── PacienteIA's own page ─────────────────── */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-ink">Página de PacienteIA (Paxi)</h2>
            <p className="text-xs text-slate mt-0.5">
              Conecta la página de Facebook de PacienteIA para que los prospectos que escriban por Messenger o Instagram sean atendidos por Paxi automáticamente.
            </p>
          </div>
          {platformConn ? (
            <span className="text-[10px] font-bold bg-lima-100 text-lima-700 px-2 py-0.5 rounded-full border border-lima-200">
              Conectada
            </span>
          ) : (
            <a
              href="/api/auth/facebook/platform"
              className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Conectar página →
            </a>
          )}
        </div>

        {platformConn && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <InfoRow label="Página" value={platformConn.page_name ?? platformConn.page_id ?? '—'} />
            <InfoRow label="Instagram" value={platformConn.instagram_account_id ? `ID: ${platformConn.instagram_account_id}` : 'No vinculado'} />
            <InfoRow
              label="Conectado"
              value={new Date(platformConn.connected_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
            />
          </div>
        )}

        {platformConn && (
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-xs text-brand-800 space-y-1.5">
            <p className="font-semibold">Configura el webhook en Meta para activar la recepción de mensajes</p>
            <p>Webhook URL: <code className="font-mono bg-white/60 px-1 rounded">{APP_URL}/api/facebook/webhook</code></p>
            <p>Verify Token: valor de <code className="font-mono bg-white/60 px-1 rounded">FACEBOOK_WEBHOOK_VERIFY_TOKEN</code> en Vercel</p>
            <p>Suscribir a: <code className="font-mono bg-white/60 px-1 rounded">messages</code>, <code className="font-mono bg-white/60 px-1 rounded">messaging_postbacks</code>, <code className="font-mono bg-white/60 px-1 rounded">leadgen</code></p>
          </div>
        )}
      </section>

      {/* ── Tenant connections ────────────────────── */}
      <section className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-fog flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ink">Conexiones de clientes</h2>
            <p className="text-xs text-slate mt-0.5">{tenantConns.length} conexiones totales</p>
          </div>
        </div>

        {tenantConns.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate">
            Ningún cliente ha conectado redes sociales todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fog bg-mist">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Clínica</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Plataforma</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Página</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Instagram</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Conectado</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fog">
                {tenantConns.map((c, i) => (
                  <tr key={i} className="hover:bg-mist transition-colors">
                    <td className="px-4 py-3 font-medium text-ink text-xs">{c.org_name}</td>
                    <td className="px-4 py-3 text-xs capitalize">
                      {c.platform === 'facebook' ? 'Facebook + IG' : c.platform}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate">{c.page_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.instagram_account_id
                        ? <span className="text-lima-600 font-medium">Vinculado</span>
                        : <span className="text-slate">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_active
                        ? <span className="text-[10px] font-bold bg-lima-100 text-lima-700 px-2 py-0.5 rounded-full">Activo</span>
                        : <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactivo</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate whitespace-nowrap">
                      {new Date(c.connected_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/tenants/${c.org_id}`}
                        className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lead breakdown */}
      {totalSocialLeads > 0 && (
        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <h2 className="font-semibold text-ink text-sm">Leads por canal (últimos 30 días)</h2>
          <div className="grid grid-cols-3 gap-4">
            {(['facebook', 'instagram', 'tiktok'] as const).map((ch) => (
              <div key={ch} className="rounded-xl border border-fog bg-mist p-4 text-center">
                <p className="text-2xl font-bold text-ink">{leadCounts[ch] ?? 0}</p>
                <p className="text-xs text-slate mt-1 capitalize">{ch}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-fog bg-white p-5">
      <p className="text-xs text-slate">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? 'text-brand-600' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate uppercase tracking-wider">{label}</p>
      <p className="text-sm text-ink mt-0.5">{value}</p>
    </div>
  )
}
