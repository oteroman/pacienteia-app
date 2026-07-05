import { redirect }           from 'next/navigation'
import { getActiveContext }   from '@/lib/tenant/context'
import { fetchMarketingData } from '@/lib/analytics/marketing'
import { logAdSpend, deleteAdSpend } from '@/app/actions/marketing'
import type { AdSpendEntry, MarketingAlert } from '@/lib/analytics/marketing'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCES: Record<string, string> = {
  facebook:  'Facebook',
  instagram: 'Instagram',
  google:    'Google Ads',
  tiktok:    'TikTok',
  other:     'Otro',
}

const ALERT_LABELS: Record<string, { label: string; color: string }> = {
  cpl_spike:      { label: 'CPL alto',           color: 'bg-amber-50 text-amber-700 border-amber-200' },
  low_conversion: { label: 'Confirmaciones bajas', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  combined:       { label: 'Fuga activa',          color: 'bg-red-50 text-red-700 border-red-200' },
}

function fmtSoles(n: number | null) {
  if (n === null) return '—'
  return `S/ ${n.toFixed(0)}`
}

function fmtPct(n: number) {
  return `${n.toFixed(0)}%`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, alert }: {
  label: string; value: string; sub?: string; alert?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-fog bg-white'}`}>
      <p className="text-xs text-slate mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-red-700' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-slate mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Spend Form ────────────────────────────────────────────────────────────────

function SpendForm({ today }: { today: string }) {
  return (
    <form action={logAdSpend} className="rounded-xl border border-fog bg-white p-5">
      <h3 className="text-sm font-semibold text-ink mb-4">Registrar gasto publicitario</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-slate mb-1">Fecha</label>
          <input
            type="date"
            name="spend_date"
            defaultValue={today}
            required
            className="w-full border border-fog rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate mb-1">Monto (S/)</label>
          <input
            type="number"
            name="amount_soles"
            min="0.01"
            step="0.01"
            placeholder="150.00"
            required
            className="w-full border border-fog rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate mb-1">Canal</label>
          <select
            name="source"
            className="w-full border border-fog rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {Object.entries(SOURCES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate mb-1">Campaña (opcional)</label>
          <input
            type="text"
            name="campaign_name"
            placeholder="Botox mayo"
            className="w-full border border-fog rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Guardar gasto
        </button>
      </div>
    </form>
  )
}

// ── Spend Table ───────────────────────────────────────────────────────────────

function SpendTable({ entries }: { entries: AdSpendEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-fog bg-white px-4 py-10 text-center text-sm text-slate">
        Sin registros de gasto. Agrega tu primera inversión arriba.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-fog bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-fog text-left">
            <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-wide">Fecha</th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-wide">Canal</th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-wide">Campaña</th>
            <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-wide text-right">Monto</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-fog">
          {entries.map(e => (
            <tr key={e.id} className="hover:bg-mist/40">
              <td className="px-4 py-3 text-slate text-xs">{fmtDate(e.spend_date + 'T12:00:00Z')}</td>
              <td className="px-4 py-3 text-slate text-xs">{SOURCES[e.source] ?? e.source}</td>
              <td className="px-4 py-3 text-slate text-xs">{e.campaign_name ?? '—'}</td>
              <td className="px-4 py-3 font-semibold text-ink text-right">{fmtSoles(e.amount_soles)}</td>
              <td className="px-4 py-3 text-right">
                <form action={deleteAdSpend.bind(null, e.id)}>
                  <button type="submit" className="text-xs text-slate hover:text-red-600 transition-colors">
                    Eliminar
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Alerts Section ────────────────────────────────────────────────────────────

function AlertsSection({ alerts }: { alerts: MarketingAlert[] }) {
  return (
    <div className="rounded-xl border border-fog bg-white p-5">
      <h3 className="text-sm font-semibold text-ink mb-3">Historial de alertas</h3>
      {alerts.length === 0 ? (
        <p className="text-sm text-slate">Sin alertas registradas — el sistema monitorea diariamente.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => {
            const meta = ALERT_LABELS[a.alert_type] ?? { label: a.alert_type, color: 'bg-mist text-slate border-fog' }
            return (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${meta.color}`}>
                  {meta.label}
                </span>
                <div className="text-slate text-xs">
                  <span>CPL: {fmtSoles(a.cpl_current)} (base: {fmtSoles(a.cpl_baseline)})</span>
                  {a.conversion_rate !== null && (
                    <span className="ml-2">· Confirmación: {fmtPct(a.conversion_rate)}</span>
                  )}
                  {a.new_leads_count !== null && (
                    <span className="ml-2">· {a.new_leads_count} leads</span>
                  )}
                </div>
                <span className="ml-auto text-xs text-slate whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Spend Chart (CSS bars) ────────────────────────────────────────────────────

function SpendChart({ spendByDay, date30d }: { spendByDay: Record<string, number>; date30d: string }) {
  const days: string[] = []
  const d = new Date(date30d + 'T12:00:00Z')
  for (let i = 0; i < 30; i++) {
    days.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }

  const max = Math.max(...days.map(day => spendByDay[day] ?? 0), 1)
  const hasData = days.some(day => (spendByDay[day] ?? 0) > 0)

  if (!hasData) return null

  return (
    <div className="rounded-xl border border-fog bg-white p-5">
      <h3 className="text-sm font-semibold text-ink mb-4">Gasto diario (últimos 30 días)</h3>
      <div className="flex items-end gap-0.5 h-20">
        {days.map(day => {
          const amount = spendByDay[day] ?? 0
          const heightPct = (amount / max) * 100
          return (
            <div
              key={day}
              className="flex-1 bg-brand-200 hover:bg-brand-400 transition-colors rounded-sm cursor-default"
              style={{ height: `${Math.max(heightPct, amount > 0 ? 4 : 0)}%` }}
              title={`${fmtDate(day + 'T12:00:00Z')}: ${fmtSoles(amount)}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-slate">
        <span>{fmtDate(date30d + 'T12:00:00Z')}</span>
        <span>Hoy</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MarketingAnalyticsPage() {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) redirect('/org-selector')
  const { organizationId, branchId } = ctx

  const { kpis, spendByDay, entries, alerts, date30d, date7d } =
    await fetchMarketingData(organizationId, branchId)

  const today = new Date().toISOString().slice(0, 10)

  // Alert condition check for banner
  const cplBaseline = kpis.cpl30d ?? kpis.cpl7d
  const hasAlert = kpis.cpl7d !== null &&
    cplBaseline !== null &&
    (kpis.cpl7d > cplBaseline * 1.3 || kpis.confirmationRate7d < 20)

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Fugas de Marketing</h1>
        <p className="text-sm text-slate mt-0.5">
          Detecta cuándo tu inversión en anuncios no está convirtiendo en citas reales.
        </p>
      </div>

      {/* Alert banner */}
      {hasAlert && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Posible fuga detectada</p>
            <p className="text-sm text-red-700 mt-0.5">
              Tu CPL esta semana ({fmtSoles(kpis.cpl7d)}) está {kpis.cpl7d && cplBaseline ? Math.round((kpis.cpl7d / cplBaseline - 1) * 100) : 0}% por encima del promedio mensual,
              y solo {fmtPct(kpis.confirmationRate7d)} de citas están confirmadas.
              El staff puede estar perdiendo leads calientes sin responder a tiempo.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Gasto últimos 7d"
          value={fmtSoles(kpis.totalSpend7d)}
          sub={`${kpis.newLeads7d} leads recibidos`}
        />
        <KpiCard
          label="CPL últimos 7d"
          value={fmtSoles(kpis.cpl7d)}
          sub={`Base 30d: ${fmtSoles(kpis.cpl30d)}`}
          alert={!!(kpis.cpl7d && cplBaseline && kpis.cpl7d > cplBaseline * 1.3)}
        />
        <KpiCard
          label="Confirmación 7d"
          value={fmtPct(kpis.confirmationRate7d)}
          sub={`Base 30d: ${fmtPct(kpis.confirmationRate30d)}`}
          alert={kpis.confirmationRate7d < 20 && kpis.confirmationRate30d > 0}
        />
        <KpiCard
          label="Gasto últimos 30d"
          value={fmtSoles(kpis.totalSpend30d)}
          sub={`${kpis.newLeads30d} leads recibidos`}
        />
      </div>

      {/* Chart */}
      <SpendChart spendByDay={spendByDay} date30d={date30d} />

      {/* Spend form */}
      <SpendForm today={today} />

      {/* Spend table */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Registro de inversión</h3>
        <SpendTable entries={entries} />
      </div>

      {/* Alerts */}
      <AlertsSection alerts={alerts} />

      {/* Help note */}
      <p className="text-xs text-slate">
        El sistema verifica automáticamente cada día si tu CPL sube más del 30% sobre la base mensual
        y la tasa de confirmación cae por debajo del 20%. Si se detecta fuga, el dueño recibe una alerta.
      </p>
    </div>
  )
}
