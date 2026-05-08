import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { getClinicPlanStatus } from '@/lib/plans/gating'
import { getFullUsage } from '@/lib/plans/usage'
import { getReactivationStats } from '@/lib/reactivation/stats'
import { getReputationStats } from '@/lib/reputation/stats'
import { UNLIMITED, type PlanFeature } from '@/lib/plans/config'
import { PlanBadge } from '@/components/plan/plan-badge'
import { UsageBar } from '@/components/plan/usage-bar'
import { UpgradeBanner } from '@/components/plan/upgrade-banner'
import { ReactivationStatsCard } from '@/components/plan/reactivation-stats'
import { ReputationStatsCard } from '@/components/plan/reputation-stats'
// Feature labels shown in the "included in your plan" section
const FEATURE_LABELS: Record<PlanFeature, string> = {
  reputation_shield:       'Escudo de reputación (encuesta + Google)',
  advanced_confirmation:   'Confirmación WhatsApp secuencia 3 pasos',
  lead_triage_ai:          'Lead triage con IA (Gemini)',
  reactivation:            'Reactivación automática pacientes inactivos',
  post_treatment_followup: 'Seguimiento post-tratamiento',
  web_forms:               'Web forms integrados',
  csv_export:              'Exportación CSV',
  roi_dashboard:           'Dashboard ROI en S/ (valor recuperado)',
  api_webhooks:            'API externa y webhooks',
}

const ALL_FEATURES: PlanFeature[] = [
  'reputation_shield',
  'advanced_confirmation',
  'lead_triage_ai',
  'reactivation',
  'post_treatment_followup',
  'web_forms',
  'csv_export',
  'roi_dashboard',
  'api_webhooks',
]

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  trialing:  { label: 'Trial activo',    className: 'bg-yellow-100 text-yellow-800' },
  active:    { label: 'Activo',          className: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Pago pendiente',  className: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Cancelado',       className: 'bg-red-100 text-red-600' },
}

export default async function BillingPage() {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const supabase = await createClient()
  const [usage, { data: rawOrg }, reactivationStats, reputationStats] = await Promise.all([
    getFullUsage(clinicId),
    (supabase as any).from('organizations').select('*').eq('id', clinicId).single(),
    getReactivationStats(clinicId),
    getReputationStats(clinicId),
  ])

  if (!rawOrg) redirect('/org-selector')

  const planStatus = await getClinicPlanStatus(clinicId, usage)
  const { sub, limits, isActive, trialDaysLeft } = planStatus

  const statusCfg = STATUS_LABELS[sub.status] ?? STATUS_LABELS.active
  const includedFeatures = limits.features as readonly string[]

  // Determine if any banner should show
  const hasHardBlock = Object.values(planStatus.usage).some(g => g.result === 'hard_blocked')
  const hasSoftBlock = !hasHardBlock && Object.values(planStatus.usage).some(g => g.result === 'soft_blocked')
  const isTrial = sub.status === 'trialing'

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── BANNERS ── */}
      {!isActive && (
        <UpgradeBanner variant="hard" currentPlan={sub.plan} resource="tu cuenta" />
      )}
      {isActive && hasHardBlock && (
        <UpgradeBanner variant="hard" currentPlan={sub.plan} />
      )}
      {isActive && hasSoftBlock && !hasHardBlock && (
        <UpgradeBanner variant="soft" currentPlan={sub.plan} />
      )}
      {isActive && isTrial && !hasHardBlock && !hasSoftBlock && (
        <UpgradeBanner variant="trial" currentPlan={sub.plan} daysLeft={trialDaysLeft} />
      )}

      {/* ── PLAN HEADER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <PlanBadge plan={sub.plan} size="lg" />
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Plan {limits.name}</h1>
            {sub.plan !== 'premium' && (
              <p className="text-sm text-gray-500">
                S/{limits.price_pen.toLocaleString('es-PE')}/mes
              </p>
            )}
          </div>
          <Link
            href="/pricing"
            className="shrink-0 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Ver planes
          </Link>
        </div>

        {/* Trial countdown or renewal date */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
          {isTrial ? (
            <p>
              Trial gratuito · vence el{' '}
              <strong className="text-gray-900">
                {sub.trial_ends_at
                  ? new Date(sub.trial_ends_at).toLocaleDateString('es-PE', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })
                  : '—'}
              </strong>
              {' '}({trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restantes)
            </p>
          ) : sub.current_period_end ? (
            <p>
              Próxima renovación:{' '}
              <strong className="text-gray-900">
                {new Date(sub.current_period_end).toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </strong>
            </p>
          ) : (
            <p className="text-gray-400">Facturación gestionada manualmente · contacta soporte</p>
          )}
        </div>
      </div>

      {/* ── USO DEL MES ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">Uso este mes</h2>

        <UsageBar label="Leads" gate={planStatus.usage.leads} />
        <UsageBar label="Citas" gate={planStatus.usage.appointments} />
        <UsageBar
          label="Usuarios activos"
          gate={planStatus.usage.users}
        />

        {Object.values(planStatus.usage).some(g => g.limit === UNLIMITED) && (
          <p className="text-xs text-gray-400">
            Los recursos con límite "Ilimitado" no tienen barra de progreso.
          </p>
        )}
      </div>

      {/* ── FEATURES INCLUIDAS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Qué incluye tu plan {limits.name}
        </h2>
        <ul className="space-y-2.5">
          {ALL_FEATURES.map((feature) => {
            const included = includedFeatures.includes(feature)
            return (
              <li key={feature} className={`flex items-center gap-2.5 text-sm ${included ? 'text-gray-700' : 'text-gray-300'}`}>
                <span className={`text-base ${included ? 'text-green-500' : 'text-gray-200'}`}>
                  {included ? '✓' : '✗'}
                </span>
                <span>{FEATURE_LABELS[feature]}</span>
                {!included && (
                  <Link href="/pricing" className="ml-auto text-xs text-brand-600 hover:underline shrink-0">
                    Desbloquear
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── REACTIVACIÓN PRO STATS ── */}
      {(limits.features as readonly string[]).includes('reactivation') && (
        <ReactivationStatsCard stats={reactivationStats} />
      )}

      {/* ── ESCUDO DE REPUTACIÓN STATS ── */}
      {(limits.features as readonly string[]).includes('reputation_shield') && (
        <ReputationStatsCard stats={reputationStats} />
      )}

      {/* ── CTA UPGRADE ── */}
      {sub.plan !== 'premium' && (
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white space-y-3">
          <h3 className="font-bold text-lg">
            {sub.plan === 'basic'
              ? 'Pasa a Pro y convierte más leads automáticamente'
              : 'Pasa a Premium y ve tu ROI en S/ cada semana'}
          </h3>
          <p className="text-brand-100 text-sm">
            {sub.plan === 'basic'
              ? '10 pacientes reactivados = S/3,500 extra al mes. El plan Pro se paga solo en días.'
              : 'Dashboard de ROI, usuarios ilimitados y account manager dedicado.'}
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-white text-brand-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-brand-50 transition-colors"
          >
            {sub.plan === 'basic' ? 'Subir a Pro →' : 'Subir a Premium →'}
          </Link>
        </div>
      )}

      {/* ── BILLING INFO (layer preparada) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Facturación</h2>
        <p className="text-sm text-gray-500 mb-3">
          Para cambiar de plan, gestionar tu facturación o solicitar una boleta/factura,
          escríbenos directamente.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="mailto:billing@pacienteia.com"
            className="text-xs font-medium text-brand-600 hover:text-brand-800 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            billing@pacienteia.com
          </a>
          <span className="text-xs text-gray-300 flex items-center px-3 py-1.5 border border-gray-100 rounded-lg">
            Próximamente: Yape · Niubiz · Izipay
          </span>
        </div>
      </div>

    </div>
  )
}
