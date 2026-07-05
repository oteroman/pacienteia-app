import Link                            from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient }           from '@/lib/supabase/admin'
import { requirePlatformAdmin }        from '@/lib/platform/auth'
import { assignProspectToRepAction }   from '@/app/actions/platform-admins'

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
  notes:        string | null
  created_at:   string
  msg_count:    number
  assigned_to:  string | null
}

interface SalesRep {
  id:    string
  label: string
}

async function getProspects(): Promise<Prospect[]> {
  noStore()
  const sb = createAdminClient() as any

  const { data: prospects } = await sb
    .from('sales_prospects')
    .select('id,phone,contact_name,clinic_name,monthly_apts,pain_point,email,status,flow_step,notes,created_at,assigned_to')
    .order('created_at', { ascending: false })

  if (!prospects?.length) return []

  const ids: string[] = prospects.map((p: any) => p.id)

  const { data: counts } = await sb
    .from('sales_messages')
    .select('prospect_id')
    .in('prospect_id', ids)

  const countMap: Record<string, number> = {}
  for (const row of (counts ?? [])) {
    countMap[row.prospect_id] = (countMap[row.prospect_id] ?? 0) + 1
  }

  return prospects.map((p: any) => ({ ...p, msg_count: countMap[p.id] ?? 0 }))
}

async function getSalesReps(): Promise<SalesRep[]> {
  const sb = createAdminClient() as any
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name')
    .eq('platform_role', 'sales')
  if (!profiles?.length) return []
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of (users ?? [])) emailMap[u.id] = u.email ?? ''
  return (profiles ?? []).map((p: any) => ({
    id:    p.id,
    label: p.full_name ?? emailMap[p.id] ?? p.id,
  }))
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:             { label: 'Nuevo',           color: 'bg-[#EEF0F3] text-slate' },
  qualifying:      { label: 'Calificando',     color: 'bg-brand-50 text-brand-700' },
  demo_requested:  { label: 'Demo solicitada', color: 'bg-amber-50 text-amber-700' },
  converted:       { label: 'Convertido',      color: 'bg-green-50 text-green-700' },
  disqualified:    { label: 'Descartado',      color: 'bg-mist text-slate' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default async function SalesPage() {
  const [prospects, salesReps, pu] = await Promise.all([
    getProspects(),
    getSalesReps(),
    requirePlatformAdmin(),
  ])

  const isSuperAdmin = pu.platform_role === 'superadmin'

  const counts = {
    total:          prospects.length,
    qualifying:     prospects.filter(p => p.status === 'qualifying').length,
    demo_requested: prospects.filter(p => p.status === 'demo_requested').length,
    converted:      prospects.filter(p => p.status === 'converted').length,
  }

  const repMap: Record<string, string> = {}
  for (const r of salesReps) repMap[r.id] = r.label

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Vendedor IA — Pipeline</h1>
        <p className="text-sm text-slate mt-0.5">
          Prospectos captados por Paxi, el bot de ventas de PacienteIA en WhatsApp.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total"           value={counts.total}          color="text-ink" />
        <StatCard label="Calificando"     value={counts.qualifying}     color="text-brand-600" />
        <StatCard label="Demo solicitada" value={counts.demo_requested} color="text-amber-600" />
        <StatCard label="Convertidos"     value={counts.converted}      color="text-lima-600" />
      </div>

      {/* Webhook config hint */}
      <div className="rounded-xl border border-fog bg-white p-4 text-xs text-slate space-y-1">
        <p className="font-semibold text-slate">Configuración del webhook en Meta</p>
        <p>URL: <code className="text-amber-700 bg-mist px-1 py-0.5 rounded">https://app.pacienteia.com/api/whatsapp/sales/webhook</code></p>
        <p>Verify Token: <code className="text-amber-700 bg-mist px-1 py-0.5 rounded">WHATSAPP_VERIFY_TOKEN</code> (mismo que clínicas)</p>
        <p>App: <code className="text-slate">1391162663028970</code> · Phone Number ID: <code className="text-slate">1137176299476928</code></p>
      </div>

      {/* Prospects table */}
      {prospects.length === 0 ? (
        <div className="rounded-xl border border-fog bg-white p-12 text-center text-slate text-sm">
          Sin prospectos aún. Cuando alguien le escriba a Paxi aparecerá aquí.
        </div>
      ) : (
        <div className="rounded-xl border border-fog bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fog text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Prospecto</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">Clínica</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden lg:table-cell">Dolor</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden sm:table-cell">Fecha</th>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Comercial</th>
                  )}
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Chat</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fog">
                {prospects.map((p) => {
                  const cfg        = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.new
                  const assignAction = assignProspectToRepAction.bind(null, p.id)
                  return (
                    <tr key={p.id} className="hover:bg-mist transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{p.contact_name ?? '—'}</p>
                        <p className="text-xs text-slate">{p.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-slate hidden md:table-cell">
                        {p.clinic_name ?? <span className="text-slate">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {p.pain_point
                          ? <span className="text-xs text-slate">{p.pain_point}</span>
                          : <span className="text-slate">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {p.email ? (
                          <a href={`mailto:${p.email}`} className="text-xs text-brand-600 hover:underline">
                            {p.email}
                          </a>
                        ) : (
                          <span className="text-slate text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate whitespace-nowrap hidden sm:table-cell">
                        {fmtDate(p.created_at)}
                      </td>

                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          {salesReps.length === 0 ? (
                            <span className="text-[11px] text-slate">
                              Sin comerciales
                            </span>
                          ) : (
                            <form action={assignAction} className="flex items-center gap-1.5">
                              <select
                                name="rep_id"
                                defaultValue={p.assigned_to ?? ''}
                                className="text-[11px] border border-fog rounded-md px-1.5 py-1 bg-white text-slate focus:outline-none focus:ring-1 focus:ring-brand-400 max-w-[140px]"
                              >
                                <option value="">Sin asignar</option>
                                {salesReps.map((r: SalesRep) => (
                                  <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="text-[10px] px-1.5 py-1 bg-[#EEF0F3] hover:bg-[#E2E5EA] text-slate rounded transition-colors"
                              >
                                ✓
                              </button>
                            </form>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3">
                        <Link
                          href={`/platform/sales/conversations/${p.id}`}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-slate hover:text-ink transition-colors"
                        >
                          <span>💬</span>
                          {p.msg_count > 0 && (
                            <span className="bg-[#EEF0F3] text-slate px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                              {p.msg_count}
                            </span>
                          )}
                          <span className="hidden sm:inline">Ver</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'demo_requested' && (
                          <Link
                            href={`/platform/tenants/new?prospect=${p.id}`}
                            className="text-[11px] font-medium text-lima-600 hover:text-lima-700 border border-lima-200 hover:border-lima-300 px-2 py-0.5 rounded transition-colors whitespace-nowrap"
                          >
                            Convertir →
                          </Link>
                        )}
                        {p.status === 'converted' && (
                          <span className="text-[11px] text-slate">✓ Creado</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-fog bg-white p-4 text-center">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate mt-1">{label}</p>
    </div>
  )
}
