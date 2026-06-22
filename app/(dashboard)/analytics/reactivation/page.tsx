import Link                        from 'next/link'
import { redirect }                from 'next/navigation'
import { createClient }            from '@/lib/supabase/server'
import { createAdminClient }       from '@/lib/supabase/admin'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import { isFeatureAllowed }        from '@/lib/plans/gating'

type Period = '30d' | '90d'
type SearchParams = Promise<{ period?: string }>

type CampaignRow = {
  id: string
  patient_id: string
  step: number
  status: string
  sent_at: string
  responded_at: string | null
  contact_phone: string | null
  patients: { full_name: string } | null
}

async function fetchStats(orgId: string, branchId: string | null, period: Period) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const days  = period === '30d' ? 30 : 90
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  let q = sb
    .from('reactivation_campaigns')
    .select('id, patient_id, step, status, sent_at, responded_at, contact_phone, patients(full_name)')
    .eq('organization_id', orgId)
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })

  if (branchId) q = q.eq('branch_id', branchId)

  const { data } = await q
  const rows = (data ?? []) as CampaignRow[]

  const step1 = rows.filter((r) => r.step === 1)
  const contacted  = step1.length
  const responded  = rows.filter((r) => r.status === 'responded').length
  const scheduled  = rows.filter((r) => r.status === 'scheduled').length

  const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0

  // Inactive patients detected (estimate: contacted + not contacted = DB query)
  const cutoff90 = new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0]
  const { count: inactiveTotal } = await sb
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .lte('last_visit_date', cutoff90)
    .not('phone', 'is', null)
    .not('status', 'in', '("blocked","lead")')

  return {
    contacted,
    responded,
    scheduled,
    responseRate,
    inactiveTotal: inactiveTotal ?? 0,
    recent: rows.slice(0, 30),
    label: period === '30d' ? 'Últimos 30 días' : 'Últimos 90 días',
  }
}

export default async function ReactivationPage({ searchParams }: { searchParams: SearchParams }) {
  const { period: p = '30d' } = await searchParams
  const period: Period = p === '90d' ? '90d' : '30d'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId    = await getActiveOrganizationId()
  const branchId = await getActiveBranchId()
  if (!orgId) redirect('/clinic-selector')

  const allowed = await isFeatureAllowed(orgId, 'reactivation')
  if (!allowed) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Analytics — Reactivación</h1>
          <p className="text-sm text-slate mt-1">Embudo de campañas de reactivación de pacientes inactivos.</p>
        </div>
        <div className="rounded-2xl border border-fog bg-white p-10 text-center space-y-4">
          <p className="text-3xl">🔒</p>
          <p className="font-semibold text-ink">Disponible en plan Pro</p>
          <p className="text-sm text-slate max-w-sm mx-auto">
            Las campañas de reactivación automática y su análisis están incluidas en el plan Pro y Premium.
          </p>
          <Link href="/pricing" className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Ver planes →
          </Link>
        </div>
      </div>
    )
  }

  const stats = await fetchStats(orgId, branchId, period)

  const STATUS_LABEL: Record<string, string> = {
    sent:      'Enviado',
    responded: 'Respondió',
    scheduled: 'Agendó',
    ignored:   'Sin respuesta',
  }
  const STATUS_COLOR: Record<string, string> = {
    sent:      'bg-blue-100 text-blue-700',
    responded: 'bg-lima-100 text-lima-700',
    scheduled: 'bg-brand-100 text-brand-700',
    ignored:   'bg-[#F3F6F9] text-slate',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Reactivación de Pacientes</h1>
          <p className="text-sm text-slate mt-1">
            {stats.label} · mensajes automáticos a pacientes inactivos 90+ días
          </p>
        </div>
        <div className="flex gap-1 bg-[#F3F6F9] rounded-lg p-1">
          {(['30d', '90d'] as Period[]).map((per) => (
            <Link key={per} href={`?period=${per}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === per ? 'bg-white text-ink shadow-xs' : 'text-slate hover:text-slate'
              }`}>
              {per === '30d' ? '30 días' : '90 días'}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Pacientes inactivos"
          value={stats.inactiveTotal}
          sub="90+ días sin cita"
          color="text-slate" bg="bg-mist" border="border-fog"
        />
        <KpiCard
          label="Contactados"
          value={stats.contacted}
          sub={`${stats.label.toLowerCase()}`}
          color="text-blue-700" bg="bg-blue-50" border="border-blue-200"
        />
        <KpiCard
          label="Respondieron"
          value={stats.responded}
          sub={`${stats.responseRate}% tasa de respuesta`}
          color={stats.responseRate >= 20 ? 'text-lima-700' : 'text-amber-700'}
          bg={stats.responseRate >= 20 ? 'bg-lima-50' : 'bg-amber-50'}
          border={stats.responseRate >= 20 ? 'border-lima-200' : 'border-amber-200'}
        />
        <KpiCard
          label="Agendaron cita"
          value={stats.scheduled}
          sub={stats.responded > 0 ? `${Math.round((stats.scheduled / stats.responded) * 100)}% de los que respondieron` : 'de los que respondieron'}
          color="text-brand-700" bg="bg-brand-50" border="border-brand-200"
        />
      </div>

      {/* Funnel */}
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Embudo de reactivación</h2>
        <div className="space-y-3">
          <FunnelRow label="Pacientes inactivos detectados" value={stats.inactiveTotal} max={stats.inactiveTotal} color="bg-gray-300" />
          <FunnelRow label="Contactados (paso 1)" value={stats.contacted} max={stats.inactiveTotal} color="bg-blue-400" />
          <FunnelRow label="Respondieron positivamente" value={stats.responded} max={stats.inactiveTotal} color="bg-green-400" />
          <FunnelRow label="Agendaron cita" value={stats.scheduled} max={stats.inactiveTotal} color="bg-brand-500" />
        </div>
      </div>

      {stats.contacted === 0 ? (
        <div className="rounded-2xl border border-dashed border-fog bg-white p-12 text-center">
          <p className="text-3xl mb-3">💤</p>
          <p className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Sin campañas enviadas aún</p>
          <p className="text-xs text-slate mt-1 max-w-sm mx-auto">
            El sistema enviará mensajes automáticamente a pacientes inactivos 90+ días.
            Activa el workflow en n8n para comenzar.
          </p>
        </div>
      ) : (
        /* Recent campaigns table */
        <section className="rounded-2xl border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-fog">
            <h2 className="text-sm font-semibold text-ink">Últimas campañas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-mist border-b border-fog">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Paciente</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Paso</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] whitespace-nowrap">Enviado</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] whitespace-nowrap">Respondió</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fog">
                {stats.recent.map((row) => (
                  <tr key={row.id} className="hover:bg-mist transition-colors">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {row.patients?.full_name?.split(' ')[0] ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate">
                      Paso {row.step}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[row.status] ?? 'bg-[#F3F6F9] text-slate'}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate">
                      {new Date(row.sent_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 text-slate">
                      {row.responded_at
                        ? new Date(row.responded_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, color, bg, border }: {
  label: string; value: string | number; sub?: string
  color: string; bg: string; border: string
}) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4`}>
      <p className="text-xs font-medium text-slate leading-tight">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-2 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate mt-1 leading-tight">{sub}</p>}
    </div>
  )
}

function FunnelRow({ label, value, max, color }: {
  label: string; value: number; max: number; color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate">{label}</span>
        <span className="font-semibold text-ink tabular-nums">
          {value} <span className="text-slate font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 bg-[#F3F6F9] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
