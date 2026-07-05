import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/tenant/context'
import { isFeatureAllowed } from '@/lib/plans/gating'
import { fetchRevenueOpportunities, type RevenueOpportunity } from '@/lib/analytics/opportunities'
import { NotifyWAButton } from './NotifyWAButton'

export default async function OpportunitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')

  const allowed = await isFeatureAllowed(ctx.organizationId, 'roi_dashboard')
  if (!allowed) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Oportunidades de Revenue</h1>
          <p className="text-sm text-slate mt-1">Pacientes con ciclo de retratamiento próximo</p>
        </div>
        <div className="rounded-2xl border border-fog bg-white p-10 text-center space-y-4">
          <p className="text-3xl">🔒</p>
          <p className="font-semibold text-ink">Disponible en plan Premium</p>
          <p className="text-sm text-slate max-w-sm mx-auto">
            El detector de oportunidades de revenue analiza el historial de cada paciente para identificar ciclos de retratamiento próximos. Incluido en el plan Premium.
          </p>
          <Link href="/pricing" className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Ver planes →
          </Link>
        </div>
      </div>
    )
  }

  const opportunities = await fetchRevenueOpportunities(ctx.organizationId)

  const overdue   = opportunities.filter((o) => o.urgency === 'overdue')
  const thisWeek  = opportunities.filter((o) => o.urgency === 'this_week')
  const upcoming  = opportunities.filter((o) => o.urgency === 'upcoming')

  const totalValue    = opportunities.length
  const totalRevenue  = opportunities.reduce((sum, o) => sum + (o.estimatedRevenue ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Oportunidades de agenda</h1>
          <p className="text-sm text-slate mt-1">
            Pacientes próximos a su ciclo de retratamiento que aún no tienen cita programada.
          </p>
        </div>
        {totalValue > 0 && (
          <div className="flex items-center gap-3">
            <span className="bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-full">
              {totalValue} oportunidad{totalValue !== 1 ? 'es' : ''}
            </span>
            {totalRevenue > 0 && (
              <span className="text-sm font-semibold text-lima-700 bg-lima-50 border border-lima-200 px-3 py-1.5 rounded-full">
                S/ {totalRevenue.toLocaleString('es-PE')} potencial
              </span>
            )}
          </div>
        )}
      </div>

      {opportunities.length === 0 && (
        <div className="rounded-2xl border bg-white p-12 text-center space-y-3">
          <p className="text-slate font-medium">Sin oportunidades pendientes</p>
          <p className="text-sm text-slate">
            Para activar esta función, define el ciclo de retratamiento en{' '}
            <Link href="/settings/services" className="text-brand-600 hover:underline">
              Ajustes → Servicios
            </Link>
            .
          </p>
        </div>
      )}

      {overdue.length > 0 && (
        <OpportunitySection
          title="Vencidas"
          description="Ya pasó su fecha ideal de retorno. Contactar hoy."
          color="red"
          items={overdue}
        />
      )}

      {thisWeek.length > 0 && (
        <OpportunitySection
          title="Esta semana"
          description="Su ciclo de retratamiento vence en los próximos 7 días."
          color="amber"
          items={thisWeek}
        />
      )}

      {upcoming.length > 0 && (
        <OpportunitySection
          title="Próximas 2 semanas"
          description="Buen momento para anticiparse y agendar."
          color="green"
          items={upcoming}
        />
      )}
    </div>
  )
}

function OpportunitySection({
  title,
  description,
  color,
  items,
}: {
  title: string
  description: string
  color: 'red' | 'amber' | 'green'
  items: RevenueOpportunity[]
}) {
  const headerColor =
    color === 'red'   ? 'text-red-700 border-red-200 bg-red-50' :
    color === 'amber' ? 'text-amber-700 border-amber-200 bg-amber-50' :
    'text-lima-700 border-lima-200 bg-lima-50'

  const badgeColor =
    color === 'red'   ? 'bg-red-100 text-red-700 border-red-200' :
    color === 'amber' ? 'bg-amber-100 text-amber-700 border-amber-200' :
    'bg-lima-100 text-lima-700 border-lima-200'

  const ctaColor =
    color === 'red'   ? 'bg-red-600 hover:bg-red-700 text-white' :
    color === 'amber' ? 'bg-amber-500 hover:bg-amber-600 text-white' :
    'bg-green-600 hover:bg-green-700 text-white'

  return (
    <section className="space-y-3">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${headerColor}`}>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
          {items.length}
        </span>
        <p className="text-xs opacity-75 hidden sm:block">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((opp) => (
          <OpportunityCard key={`${opp.patientId}:${opp.treatmentType}`} opp={opp} ctaColor={ctaColor} />
        ))}
      </div>
    </section>
  )
}

function OpportunityCard({ opp, ctaColor }: { opp: RevenueOpportunity; ctaColor: string }) {
  const lastAptLabel = new Date(opp.lastAptAt).toLocaleDateString('es-PE', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const dueLabel = opp.daysUntilDue < 0
    ? `Venció hace ${Math.abs(opp.daysUntilDue)} días`
    : opp.daysUntilDue === 0
      ? 'Vence hoy'
      : `Vence en ${opp.daysUntilDue} día${opp.daysUntilDue !== 1 ? 's' : ''}`

  const newAptUrl = `/appointments/new?patient_id=${opp.patientId}&treatment_type=${encodeURIComponent(opp.treatmentType)}`

  return (
    <div className="bg-white rounded-2xl border border-fog shadow-xs overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/patients/${opp.patientId}`} className="text-sm font-semibold text-ink hover:text-brand-600 truncate block">
              {opp.patientName}
            </Link>
            <p className="text-xs text-slate mt-0.5">{opp.treatmentType}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              opp.urgency === 'overdue'   ? 'bg-red-100 text-red-700' :
              opp.urgency === 'this_week' ? 'bg-amber-100 text-amber-700' :
              'bg-lima-100 text-lima-700'
            }`}>
              {dueLabel}
            </span>
            {opp.estimatedRevenue != null && (
              <span className="text-xs font-semibold text-lima-700">
                S/ {Number(opp.estimatedRevenue).toFixed(0)}
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate mt-2">
          Última cita: {lastAptLabel}
          {opp.phone && <> · {opp.phone}</>}
        </p>
      </div>

      <div className="px-5 pb-4 flex gap-2">
        {opp.phone && (
          <NotifyWAButton
            patientId={opp.patientId}
            patientName={opp.patientName}
            phone={opp.phone}
            treatmentType={opp.treatmentType}
          />
        )}
        <Link
          href={newAptUrl}
          className={`flex-1 block text-center text-xs font-semibold py-2 rounded-xl transition-colors ${ctaColor}`}
        >
          Agendar →
        </Link>
      </div>
    </div>
  )
}
