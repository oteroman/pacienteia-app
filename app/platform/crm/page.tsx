import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { requirePlatformAdmin, hasRole } from '@/lib/platform/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

interface RepProspect {
  id:           string
  phone:        string
  contact_name: string | null
  clinic_name:  string | null
  status:       string
  created_at:   string
}

interface RepClient {
  id:                 string
  name:               string
  plan:               string | null
  subscription_status: string | null
  created_at:         string
}

interface RepProfile {
  id:              string
  email:           string
  full_name:       string | null
  commission_rate: number
}

async function getCrmData(repId: string, isSuperAdmin: boolean) {
  noStore()
  const sb = createAdminClient() as any

  const prospectsQuery = sb
    .from('sales_prospects')
    .select('id,phone,contact_name,clinic_name,status,created_at')
    .order('created_at', { ascending: false })

  const clientsQuery = sb
    .from('organizations')
    .select('id,name,plan,subscription_status,created_at')
    .eq('subscription_status', 'active')
    .order('created_at', { ascending: false })

  // If sales role: filter to their assigned prospects/clients
  if (!isSuperAdmin) {
    prospectsQuery.eq('assigned_to', repId)
    clientsQuery.eq('acquisition_rep_id', repId)
  }

  const [{ data: prospects }, { data: clients }] = await Promise.all([prospectsQuery, clientsQuery])

  return {
    prospects: (prospects ?? []) as RepProspect[],
    clients:   (clients ?? [])   as RepClient[],
  }
}

async function getAllReps(): Promise<RepProfile[]> {
  const sb = createAdminClient() as any
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, commission_rate')
    .eq('platform_role', 'sales')

  if (!profiles?.length) return []

  const ids: string[] = profiles.map((p: any) => p.id)
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of (users ?? [])) emailMap[u.id] = u.email ?? ''

  return profiles.map((p: any) => ({
    id:              p.id,
    email:           emailMap[p.id] ?? '',
    full_name:       p.full_name ?? null,
    commission_rate: p.commission_rate ?? 0,
  }))
}

const STATUS_LABEL: Record<string, string> = {
  new:             'Nuevo',
  qualifying:      'Calificando',
  demo_requested:  'Demo pedida',
  converted:       'Convertido',
  disqualified:    'Descartado',
}

const STATUS_COLOR: Record<string, string> = {
  new:            'bg-[#EEF0F3] text-slate',
  qualifying:     'bg-brand-50 text-brand-700',
  demo_requested: 'bg-amber-50 text-amber-700',
  converted:      'bg-green-50 text-green-700',
  disqualified:   'bg-mist text-slate',
}

const SUB_COLOR: Record<string, string> = {
  active:    'bg-green-50 text-green-700',
  trialing:  'bg-brand-50 text-brand-700',
  cancelled: 'bg-red-50 text-red-700',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function CrmPage() {
  const pu          = await requirePlatformAdmin()
  const isSuperAdmin = hasRole(pu, ['superadmin'])

  const [{ prospects, clients }, allReps] = await Promise.all([
    getCrmData(pu.id, isSuperAdmin),
    isSuperAdmin ? getAllReps() : Promise.resolve([] as RepProfile[]),
  ])

  // My commission data (for sales role)
  const sb             = createAdminClient() as any
  let commissionRate   = 0
  if (!isSuperAdmin) {
    const { data: profile } = await sb
      .from('profiles')
      .select('commission_rate')
      .eq('id', pu.id)
      .single()
    commissionRate = profile?.commission_rate ?? 0
  }

  const activeClients   = clients.filter(c => c.subscription_status === 'active')
  const mrr             = activeClients.reduce((sum, c) => sum + (PLAN_CONFIG[c.plan as Plan]?.price_pen ?? 0), 0)
  const myCommission    = Math.round(mrr * commissionRate / 100)

  const pipeline = {
    total:          prospects.length,
    qualifying:     prospects.filter(p => p.status === 'qualifying').length,
    demo_requested: prospects.filter(p => p.status === 'demo_requested').length,
    converted:      prospects.filter(p => p.status === 'converted').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          {isSuperAdmin ? 'CRM Comercial — Vista General' : 'Mi Pipeline de Ventas'}
        </h1>
        <p className="text-sm text-slate mt-0.5">
          {isSuperAdmin
            ? 'Pipeline de todos los comerciales + clientes captados.'
            : 'Tus prospectos, clientes captados y comisiones.'}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="MRR mis clientes"  value={`S/ ${mrr.toLocaleString('es-PE')}`} color="text-lima-600" accent />
        {!isSuperAdmin && (
          <StatCard label="Mi comisión mensual" value={`S/ ${myCommission.toLocaleString('es-PE')}`} color="text-brand-600" />
        )}
        <StatCard label="Prospectos"     value={pipeline.total}          color="text-ink" />
        <StatCard label="Demo solicitada" value={pipeline.demo_requested} color="text-amber-600" />
        <StatCard label="Convertidos"    value={pipeline.converted}      color="text-lima-600" />
      </div>

      {/* Superadmin: rep selector */}
      {isSuperAdmin && allReps.length > 0 && (
        <section className="rounded-xl border border-fog bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-fog">
            <h2 className="text-sm font-semibold text-ink">Equipo comercial</h2>
          </div>
          <div className="divide-y divide-fog">
            {allReps.map((rep) => (
              <div key={rep.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{rep.full_name ?? rep.email}</p>
                  <p className="text-xs text-slate">{rep.email}</p>
                </div>
                <p className="text-xs text-slate">
                  Comisión: <span className="font-semibold text-lima-600">{rep.commission_rate}%</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pipeline (prospects) */}
        <section className="rounded-xl border border-fog bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Pipeline — prospectos
              <span className="ml-2 text-xs font-bold bg-[#EEF0F3] text-slate px-2 py-0.5 rounded-full">
                {prospects.length}
              </span>
            </h2>
            <Link href="/platform/sales" className="text-xs text-slate hover:text-ink">
              Ver todo →
            </Link>
          </div>
          {prospects.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate text-center">Sin prospectos asignados.</p>
          ) : (
            <div className="divide-y divide-fog">
              {prospects.slice(0, 8).map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{p.contact_name ?? p.phone}</p>
                    {p.clinic_name && <p className="text-xs text-slate truncate">{p.clinic_name}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status] ?? STATUS_COLOR.new}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                    <Link
                      href={`/platform/sales/conversations/${p.id}`}
                      className="text-[11px] text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Ver
                    </Link>
                  </div>
                </div>
              ))}
              {prospects.length > 8 && (
                <div className="px-5 py-3">
                  <Link href="/platform/sales" className="text-xs text-brand-600 hover:text-brand-700">
                    Ver {prospects.length - 8} más →
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Converted clients */}
        <section className="rounded-xl border border-fog bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Clientes captados
              <span className="ml-2 text-xs font-bold bg-[#EEF0F3] text-slate px-2 py-0.5 rounded-full">
                {clients.length}
              </span>
            </h2>
            {isSuperAdmin && (
              <Link href="/platform/tenants" className="text-xs text-slate hover:text-ink">
                Ver todos →
              </Link>
            )}
          </div>
          {clients.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate text-center">Sin clientes captados aún.</p>
          ) : (
            <div className="divide-y divide-fog">
              {clients.slice(0, 8).map((c) => {
                const planPrice = PLAN_CONFIG[c.plan as Plan]?.price_pen ?? 0
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{c.name}</p>
                      <p className="text-xs text-slate">Desde {fmtDate(c.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {planPrice > 0 && (
                        <span className="text-xs font-semibold text-lima-600">
                          S/ {planPrice.toLocaleString('es-PE')}/mes
                        </span>
                      )}
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${SUB_COLOR[c.subscription_status ?? ''] ?? 'bg-mist text-slate'}`}>
                        {c.plan ?? '—'}
                      </span>
                      {isSuperAdmin && (
                        <Link
                          href={`/platform/tenants/${c.id}`}
                          className="text-[11px] text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Ver
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
              {clients.length > 8 && (
                <div className="px-5 py-3">
                  <p className="text-xs text-slate">+{clients.length - 8} clientes más</p>
                </div>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Commission summary (for sales role) */}
      {!isSuperAdmin && (
        <section className="rounded-xl border border-lima-200 bg-lima-50/60 shadow-xs p-6">
          <h2 className="text-sm font-semibold text-lima-700 mb-3">Resumen de comisiones</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-lima-600 font-mono tabular-nums">{clients.length}</p>
              <p className="text-xs text-slate mt-1 uppercase tracking-wide">Clientes activos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-lima-600 font-mono tabular-nums">S/ {mrr.toLocaleString('es-PE')}</p>
              <p className="text-xs text-slate mt-1 uppercase tracking-wide">MRR generado</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-600 font-mono tabular-nums">{commissionRate}%</p>
              <p className="text-xs text-slate mt-1 uppercase tracking-wide">Tu comisión</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink font-mono tabular-nums">S/ {myCommission.toLocaleString('es-PE')}</p>
              <p className="text-xs text-slate mt-1 uppercase tracking-wide">Este mes</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ label, value, color, accent }: { label: string; value: number | string; color: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-center shadow-xs ${accent ? 'border-lima-200 bg-lima-50' : 'border-fog bg-white'}`}>
      <p className={`text-2xl font-bold tabular-nums font-mono ${color}`}>{value}</p>
      <p className="text-xs text-slate mt-1 uppercase tracking-wide">{label}</p>
    </div>
  )
}
