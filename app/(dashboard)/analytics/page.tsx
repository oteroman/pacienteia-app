import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'
import { redirect } from 'next/navigation'

type Period = '7d' | '30d' | 'month'

function buildWindow(period: Period): {
  start: string; prevStart: string; prevEnd: string; label: string
} {
  const now = new Date()

  if (period === '7d') {
    const start = new Date(now.getTime() - 7 * 86400000)
    return {
      start:     start.toISOString(),
      prevStart: new Date(now.getTime() - 14 * 86400000).toISOString(),
      prevEnd:   start.toISOString(),
      label:     'Últimos 7 días',
    }
  }

  if (period === 'month') {
    const start     = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return {
      start:     start.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd:   start.toISOString(),
      label:     'Este mes',
    }
  }

  // 30d (default)
  const start = new Date(now.getTime() - 30 * 86400000)
  return {
    start:     start.toISOString(),
    prevStart: new Date(now.getTime() - 60 * 86400000).toISOString(),
    prevEnd:   start.toISOString(),
    label:     'Últimos 30 días',
  }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: raw } = await searchParams
  const period: Period  = raw === '7d' || raw === 'month' ? raw : '30d'

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId } = ctx

  const { start, prevStart, prevEnd, label } = buildWindow(period)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [
    leadsRes, prevLeadsRes,
    aptsRes, prevAptsRes,
    scheduledRes, prevScheduledRes,
    remindersRes,
    slaRes,
    followupsRes,
  ] = await Promise.all([
    // Leads recibidos — current
    sb.from('intake_items')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', start),

    // Leads recibidos — prev
    sb.from('intake_items')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', prevStart)
      .lt('created_at', prevEnd),

    // Citas agendadas — current (by created_at)
    sb.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', start),

    // Citas agendadas — prev
    sb.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', prevStart)
      .lt('created_at', prevEnd),

    // Completadas + ingresos — current (by scheduled_at)
    sb.from('appointments')
      .select('status, price')
      .eq('organization_id', organizationId)
      .gte('scheduled_at', start)
      .neq('status', 'cancelled'),

    // Completadas + ingresos — prev
    sb.from('appointments')
      .select('status, price')
      .eq('organization_id', organizationId)
      .gte('scheduled_at', prevStart)
      .lt('scheduled_at', prevEnd)
      .neq('status', 'cancelled'),

    // Recordatorios 24h — confirmation rate
    sb.from('appointment_reminders')
      .select('status')
      .eq('organization_id', organizationId)
      .eq('reminder_type', '24h')
      .gte('sent_at', start),

    // SLA leads
    sb.from('intake_items')
      .select('first_response_at, sla_due_at')
      .eq('organization_id', organizationId)
      .gte('created_at', start)
      .not('first_response_at', 'is', null)
      .not('sla_due_at', 'is', null),

    // NPS — followup ratings
    sb.from('appointment_followups')
      .select('rating')
      .eq('organization_id', organizationId)
      .gte('sent_at', start)
      .not('rating', 'is', null),
  ])

  // ── Funnel ────────────────────────────────────────────────────
  const leadsCount     = (leadsRes.count     ?? 0) as number
  const prevLeadsCount = (prevLeadsRes.count  ?? 0) as number
  const aptsCount      = (aptsRes.count       ?? 0) as number
  const prevAptsCount  = (prevAptsRes.count   ?? 0) as number

  type AptRow = { status: string; price: number | null }
  const scheduled     = (scheduledRes.data     ?? []) as AptRow[]
  const prevScheduled = (prevScheduledRes.data ?? []) as AptRow[]

  const completadas     = scheduled.filter((a) => a.status === 'completed').length
  const prevCompletadas = prevScheduled.filter((a) => a.status === 'completed').length

  const ingresos     = scheduled
    .filter((a) => a.status === 'completed' && a.price != null)
    .reduce((s, a) => s + (a.price ?? 0), 0)
  const prevIngresos = prevScheduled
    .filter((a) => a.status === 'completed' && a.price != null)
    .reduce((s, a) => s + (a.price ?? 0), 0)

  // ── Efficiency ────────────────────────────────────────────────
  const fillRate = scheduled.length > 0
    ? Math.round((completadas / scheduled.length) * 100)
    : null

  type RemRow = { status: string }
  const reminders    = (remindersRes.data ?? []) as RemRow[]
  const r24Active    = reminders.filter((r) => r.status !== 'failed').length
  const r24Confirmed = reminders.filter((r) => r.status === 'confirmed').length
  const confirmRate  = r24Active > 0 ? Math.round((r24Confirmed / r24Active) * 100) : null

  type SLARow = { first_response_at: string; sla_due_at: string }
  const slaRows = (slaRes.data ?? []) as SLARow[]
  const slaMet  = slaRows.filter(
    (r) => new Date(r.first_response_at) <= new Date(r.sla_due_at),
  ).length
  const slaRate = slaRows.length > 0 ? Math.round((slaMet / slaRows.length) * 100) : null

  type FRow = { rating: number }
  const followups  = (followupsRes.data ?? []) as FRow[]
  const promoters  = followups.filter((r) => r.rating >= 4).length
  const detractors = followups.filter((r) => r.rating <= 2).length
  const nps        = followups.length > 0
    ? Math.round(((promoters - detractors) / followups.length) * 100)
    : null
  const avgRating  = followups.length > 0
    ? (followups.reduce((s, r) => s + r.rating, 0) / followups.length).toFixed(1)
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Indicadores operacionales</h1>
          <p className="text-sm text-slate mt-1">{label}</p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* Fila 1 — Funnel */}
      <section>
        <h2 className="text-xs font-semibold text-slate uppercase tracking-widest mb-3">
          Funnel de operación
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FunnelCard
            label="Consultas recibidas"
            value={leadsCount}
            prev={prevLeadsCount}
            format="number"
            color="text-ai-500"
          />
          <FunnelCard
            label="Citas agendadas"
            value={aptsCount}
            prev={prevAptsCount}
            format="number"
            color="text-brand-600"
          />
          <FunnelCard
            label="Citas completadas"
            value={completadas}
            prev={prevCompletadas}
            format="number"
            color="text-lima-600"
          />
          <FunnelCard
            label="Ingresos"
            value={ingresos}
            prev={prevIngresos}
            format="currency"
            color="text-emerald-600"
          />
        </div>
      </section>

      {/* Fila 2 — Eficiencia */}
      <section>
        <h2 className="text-xs font-semibold text-slate uppercase tracking-widest mb-3">
          Eficiencia operativa
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <EffCard
            label="Fill rate"
            value={fillRate !== null ? `${fillRate}%` : '—'}
            sub={
              scheduled.length > 0
                ? `${completadas} de ${scheduled.length} citas`
                : 'Sin citas en el período'
            }
            health={
              fillRate === null ? 'empty'
              : fillRate >= 60   ? 'good'
              : fillRate >= 40   ? 'warn'
              : 'bad'
            }
          />
          <EffCard
            label="Tasa confirmación"
            value={confirmRate !== null ? `${confirmRate}%` : '—'}
            sub={
              r24Active > 0
                ? `${r24Confirmed} de ${r24Active} respondieron`
                : 'Sin recordatorios aún'
            }
            health={
              confirmRate === null ? 'empty'
              : confirmRate >= 60   ? 'good'
              : confirmRate >= 30   ? 'warn'
              : 'bad'
            }
          />
          <EffCard
            label="SLA leads (&lt;2h)"
            value={slaRate !== null ? `${slaRate}%` : '—'}
            sub={
              slaRows.length > 0
                ? `${slaMet} de ${slaRows.length} a tiempo`
                : 'Sin datos SLA aún'
            }
            health={
              slaRate === null ? 'empty'
              : slaRate >= 70   ? 'good'
              : slaRate >= 40   ? 'warn'
              : 'bad'
            }
          />
          <EffCard
            label="NPS pacientes"
            value={nps !== null ? String(nps) : '—'}
            sub={
              avgRating
                ? `Nota media ${avgRating}/5 (${followups.length} resp.)`
                : 'Sin encuestas aún'
            }
            health={
              nps === null ? 'empty'
              : nps >= 50   ? 'good'
              : nps >= 0    ? 'warn'
              : 'bad'
            }
          />
        </div>
      </section>

      {/* Fila 3 — Análisis detallado */}
      <section>
        <h2 className="text-xs font-semibold text-slate uppercase tracking-widest mb-3">
          Análisis detallado
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SubCard
            href="/analytics/reminders"
            icon="🔔"
            title="Recordatorios"
            desc="Confirmaciones y no-shows por WhatsApp"
          />
          <SubCard
            href="/analytics/reputation"
            icon="⭐"
            title="Reputación"
            desc="Encuestas post-cita y escudo Google Reviews"
          />
          <SubCard
            href="/analytics/reactivation"
            icon="🔄"
            title="Reactivación"
            desc="Pacientes inactivos reconvertidos"
          />
          <SubCard
            href="/analytics/revenue"
            icon="💰"
            title="Revenue"
            desc="Ingresos, recuperación y fill rate histórico"
          />
        </div>
      </section>
    </div>
  )
}

// ── Components ────────────────────────────────────────────────

function PeriodSelector({ current }: { current: Period }) {
  const options: { key: Period; label: string }[] = [
    { key: '7d',    label: '7 días'   },
    { key: '30d',   label: '30 días'  },
    { key: 'month', label: 'Este mes' },
  ]
  return (
    <div className="flex items-center gap-1 bg-[#F3F6F9] rounded-xl p-1">
      {options.map(({ key, label }) => (
        <Link
          key={key}
          href={`/analytics?period=${key}`}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            current === key
              ? 'bg-white text-ink shadow-xs'
              : 'text-slate hover:text-slate'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}

function calcDelta(
  curr: number,
  prev: number,
): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (prev === 0) return { pct: 0, dir: 'flat' }
  const pct = Math.round(((curr - prev) / prev) * 100)
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

function FunnelCard({
  label,
  value,
  prev,
  format,
  color,
}: {
  label: string
  value: number
  prev: number
  format: 'number' | 'currency'
  color: string
}) {
  const d           = calcDelta(value, prev)
  const display     = format === 'currency' ? `S/ ${value.toLocaleString('es-PE')}` : value.toLocaleString('es-PE')
  const prevDisplay = format === 'currency' ? `S/ ${prev.toLocaleString('es-PE')}` : String(prev)

  return (
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-5">
      <p className="text-sm text-slate">{label}</p>
      <p className={`text-3xl font-bold tabular-nums mt-1 ${color}`}>{display}</p>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {d.dir !== 'flat' && (
          <span
            className={`text-xs font-semibold ${
              d.dir === 'up' ? 'text-lima-600' : 'text-red-500'
            }`}
          >
            {d.dir === 'up' ? '▲' : '▼'} {d.pct}%
          </span>
        )}
        <span className="text-xs text-slate">vs anterior ({prevDisplay})</span>
      </div>
    </div>
  )
}

type Health = 'good' | 'warn' | 'bad' | 'empty'

function EffCard({
  label,
  value,
  sub,
  health,
}: {
  label: string
  value: string
  sub: string
  health: Health
}) {
  const colorMap: Record<Health, string> = {
    good:  'text-lima-600',
    warn:  'text-amber-600',
    bad:   'text-red-500',
    empty: 'text-slate',
  }
  const dotMap: Record<Health, string> = {
    good:  'bg-lima-500',
    warn:  'bg-amber-500',
    bad:   'bg-red-500',
    empty: 'bg-gray-300',
  }
  return (
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotMap[health]}`} />
        <p className="text-sm text-slate">{label}</p>
      </div>
      <p className={`text-3xl font-bold tabular-nums mt-1 ${colorMap[health]}`}>{value}</p>
      <p className="text-xs text-slate mt-1.5">{sub}</p>
    </div>
  )
}

function SubCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string
  icon: string
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-fog shadow-xs p-5 hover:shadow-md hover:border-brand-100 transition-all"
    >
      <div className="text-2xl mb-3">{icon}</div>
      <p className="text-sm font-semibold text-ink group-hover:text-brand-700 transition-colors">
        {title}
      </p>
      <p className="text-xs text-slate mt-1 leading-snug">{desc}</p>
      <p className="text-xs text-brand-600 mt-3 font-medium">Ver análisis →</p>
    </Link>
  )
}
