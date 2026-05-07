import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchClinicValue } from '@/lib/customer-health/value'
import { deriveSignals, SIGNAL_PLAYBOOKS, isExpansionSignal } from '@/lib/customer-health/signals'
import type { SignalType } from '@/lib/customer-health/signals'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { Plan } from '@/lib/plans/config'

export default async function ClinicValuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const value = await fetchClinicValue(clinicId)
  if (!value) redirect('/dashboard')

  const signals    = deriveSignals(value)
  const expansion  = signals.filter((s) => isExpansionSignal(s.type))
  const risk       = signals.filter((s) => !isExpansionSignal(s.type))
  const topSignal  = signals[0] ?? null
  const planConfig = PLAN_CONFIG[value.plan as Plan] ?? PLAN_CONFIG.basic

  const roiVsPlan = value.roi.planCost > 0
    ? value.roi.roi30d / value.roi.planCost
    : 0

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Valor generado</h1>
        <p className="text-sm text-gray-500 mt-1">
          Estimado de impacto de PacienteIA en tu clínica este mes
        </p>
      </div>

      {/* ROI comparison strip */}
      <div className="rounded-2xl border bg-white p-6 space-y-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">ROI estimado</p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Últimos 7 días</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">
              S/ {Math.round(value.roi.roi7d).toLocaleString('es-PE')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Este mes</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">
              S/ {Math.round(value.roi.roi30d).toLocaleString('es-PE')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Acumulado histórico</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums mt-0.5">
              S/ {Math.round(value.roi.roiHistorical).toLocaleString('es-PE')}
            </p>
          </div>
        </div>

        {/* Plan comparison */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Plan {planConfig.name} · S/ {value.roi.planCost.toLocaleString('es-PE')}/mes
            </span>
            <ROIMultiplierBadge multiplier={roiVsPlan} />
          </div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${roiVsPlan >= 1 ? 'bg-green-400' : roiVsPlan >= 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(100, roiVsPlan * 50)}%` }}
            />
          </div>
          {value.message && (
            <p className="text-sm text-gray-600 mt-2 font-medium">{value.message}</p>
          )}
        </div>
      </div>

      {/* Value score */}
      <div className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Value score</p>
          <span className={`text-2xl font-bold tabular-nums ${value.valueScore.total >= 70 ? 'text-green-600' : value.valueScore.total >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
            {value.valueScore.total}<span className="text-sm font-normal text-gray-400">/100</span>
          </span>
        </div>

        {/* Score bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${value.valueScore.total >= 70 ? 'bg-green-400' : value.valueScore.total >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${value.valueScore.total}%` }}
          />
        </div>

        {/* Dimension breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Leads recuperados', val: value.valueScore.leads,     max: 25 },
            { label: 'Citas confirmadas', val: value.valueScore.confirmed, max: 25 },
            { label: 'No-shows evitados', val: value.valueScore.noShow,    max: 15 },
            { label: 'Reactivaciones',    val: value.valueScore.patients,  max: 15 },
            { label: 'Tareas cerradas',   val: value.valueScore.tasks,     max: 10 },
            { label: 'Días activos',      val: value.valueScore.activity,  max: 10 },
          ].map((d) => (
            <div key={d.label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-gray-400">{d.label}</p>
              <div className="flex items-end gap-1 mt-1">
                <span className={`text-lg font-bold tabular-nums ${d.val < d.max * 0.4 ? 'text-amber-500' : 'text-gray-800'}`}>
                  {d.val}
                </span>
                <span className="text-xs text-gray-300 mb-0.5">/{d.max}</span>
              </div>
              <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.val >= d.max * 0.7 ? 'bg-green-400' : d.val >= d.max * 0.4 ? 'bg-amber-400' : 'bg-red-300'}`}
                  style={{ width: `${Math.round((d.val / d.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Top driver */}
        {value.topAction !== 'Sin actividad registrada' && (
          <p className="text-xs text-gray-400">
            Principal generador de valor este mes: <span className="text-gray-600 font-medium">{value.topAction}</span>
          </p>
        )}
      </div>

      {/* Expansion signals */}
      {expansion.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 space-y-3">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Oportunidad</p>
          {expansion.map((s) => (
            <div key={s.type}>
              <p className="text-sm font-semibold text-blue-800">{SIGNAL_PLAYBOOKS[s.type].label}</p>
              <p className="text-sm text-blue-700 mt-1">
                {SIGNAL_PLAYBOOKS[s.type].messageTemplate
                  .replace('[nombre]', 'tu clínica')
                  .replace('[roi]', `S/ ${Math.round(value.roi.roi30d).toLocaleString('es-PE')}`)}
              </p>
              <p className="text-xs text-blue-500 mt-1">
                Habla con tu ejecutivo de cuenta para conocer las opciones de upgrade.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Risk signals — shown only as helpful info, not as alarm */}
      {risk.length > 0 && expansion.length === 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 space-y-2">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Cómo mejorar tu score</p>
          <p className="text-sm text-amber-800">
            Tu uso de PacienteIA tiene potencial para crecer. Estas acciones pueden aumentar tu valor generado:
          </p>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            {value.valueScore.confirmed < 10 && (
              <li>Confirma más citas usando los recordatorios automáticos</li>
            )}
            {value.valueScore.leads < 15 && (
              <li>Activa el seguimiento de leads para recuperar más oportunidades</li>
            )}
            {value.valueScore.patients < 8 && (
              <li>Configura campañas de reactivación para pacientes inactivos</li>
            )}
            {value.valueScore.activity < 6 && (
              <li>Usa PacienteIA todos los días para maximizar el impacto</li>
            )}
          </ul>
        </div>
      )}

    </div>
  )
}

// ── Components ────────────────────────────────────────────────

function ROIMultiplierBadge({ multiplier }: { multiplier: number }) {
  if (multiplier >= 2)   return <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Ya recuperaste {multiplier.toFixed(1)}× tu plan</span>
  if (multiplier >= 1)   return <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Cubriste el costo del plan</span>
  if (multiplier >= 0.5) return <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{Math.round(multiplier * 100)}% recuperado</span>
  return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Potencial por activar</span>
}
