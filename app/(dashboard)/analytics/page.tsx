import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'

type GatingEventRow = {
  event:       string
  resource:    string | null
  gate_state:  string | null
  operation:   string | null
  source_page: string | null
  created_at:  string
}

function pct(num: number, den: number) {
  return den === 0 ? 0 : Math.round((num / den) * 100)
}

export default async function AnalyticsPage() {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const supabase = await createClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('gating_events')
    .select('event, resource, gate_state, operation, source_page, created_at')
    .eq('clinic_id', clinicId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  const events = (data ?? []) as GatingEventRow[]

  // ── Aggregates ──────────────────────────────────────────
  const blocked   = events.filter((e) => e.event === 'blocked_action_attempted')
  const opened    = events.filter((e) => e.event === 'modal_opened')
  const closed    = events.filter((e) => e.event === 'modal_closed')
  const primary   = events.filter((e) => e.event === 'cta_primary_clicked')
  const secondary = events.filter((e) => e.event === 'cta_secondary_clicked')

  const modalOpenRate   = pct(opened.length,  blocked.length)
  const ctaConvertRate  = pct(primary.length,  opened.length)

  // Breakdown by resource
  const resources = ['leads', 'appointments', 'users'] as const
  const byResource = resources.map((r) => ({
    resource: r,
    blocked:   blocked.filter((e) => e.resource === r).length,
    soft:      blocked.filter((e) => e.resource === r && e.gate_state === 'soft_blocked').length,
    hard:      blocked.filter((e) => e.resource === r && e.gate_state === 'hard_blocked').length,
  }))

  // Breakdown by source page
  const pageBreakdown = events
    .filter((e) => e.event === 'blocked_action_attempted' && e.source_page)
    .reduce<Record<string, number>>((acc, e) => {
      const p = e.source_page!
      acc[p] = (acc[p] ?? 0) + 1
      return acc
    }, {})

  // Recent events (last 20)
  const recent = events.slice(0, 20)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Métricas de gating</h1>
        <p className="text-sm text-gray-500 mt-1">Últimos 30 días · tu clínica</p>
      </div>

      {/* ── Funnel summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Metric label="Intentos bloqueados"   value={blocked.length}  />
        <Metric label="Modales abiertos"      value={opened.length}   sub={`${modalOpenRate}% de intentos`} />
        <Metric label="Modales cerrados"      value={closed.length}   />
        <Metric label="CTA primario"          value={primary.length}  sub={`${ctaConvertRate}% de abiertos`} highlight />
        <Metric label="Ver mi plan"           value={secondary.length} />
      </div>

      {/* ── By resource ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Bloqueos por recurso</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-medium">Recurso</th>
              <th className="pb-2 font-medium text-right">Total</th>
              <th className="pb-2 font-medium text-right">Soft (80%)</th>
              <th className="pb-2 font-medium text-right">Hard (100%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {byResource.map((r) => (
              <tr key={r.resource} className={r.blocked === 0 ? 'text-gray-300' : 'text-gray-900'}>
                <td className="py-2.5 capitalize">{r.resource}</td>
                <td className="py-2.5 text-right font-medium">{r.blocked}</td>
                <td className="py-2.5 text-right text-amber-600">{r.soft}</td>
                <td className="py-2.5 text-right text-red-600">{r.hard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── By page ── */}
      {Object.keys(pageBreakdown).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Bloqueos por página</h2>
          <ul className="space-y-2">
            {Object.entries(pageBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([page, count]) => (
                <li key={page} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-mono">{page}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* ── Recent events ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Eventos recientes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Sin eventos aún · los datos aparecen cuando los usuarios interactúan con botones bloqueados
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recent.map((e, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <EventIcon event={e.event} />
                  <span className="text-gray-700 truncate">{e.event}</span>
                  {e.resource && (
                    <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                      {e.resource}
                    </span>
                  )}
                  {e.gate_state && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      e.gate_state === 'hard_blocked'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {e.gate_state === 'hard_blocked' ? 'hard' : 'soft'}
                    </span>
                  )}
                </div>
                <time className="text-xs text-gray-400 shrink-0">
                  {new Date(e.created_at).toLocaleString('es-PE', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12 text-gray-400 space-y-2">
          <p className="text-4xl">📊</p>
          <p className="text-sm">
            Sin datos aún. Los eventos se registran cuando un usuario intenta crear o editar algo mientras está bloqueado.
          </p>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, sub, highlight }: {
  label: string; value: number; sub?: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 text-center space-y-1 ${highlight ? 'bg-brand-50 border border-brand-100' : 'bg-gray-50'}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function EventIcon({ event }: { event: string }) {
  const icons: Record<string, string> = {
    blocked_action_attempted: '🚫',
    modal_opened:             '📋',
    modal_closed:             '✕',
    cta_primary_clicked:      '⬆️',
    cta_secondary_clicked:    '👁',
  }
  return <span className="text-base leading-none">{icons[event] ?? '•'}</span>
}
