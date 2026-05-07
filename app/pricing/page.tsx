import Link from 'next/link'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { PlanFeature } from '@/lib/plans/config'

// ─────────────────────────────────────────
// Feature labels shown in the pricing cards
// ─────────────────────────────────────────
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

// All features in display order
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

// Plan-level metadata for the marketing copy
const PLAN_META = {
  basic: {
    tagline: 'Organiza y protege tu agenda',
    pitch: 'Para la cosmetóloga o consultorio que quiere dejar de perder citas por olvidos y cuidar su reputación en Google desde el día 1.',
    color: 'border-gray-200',
    ctaClass: 'bg-gray-900 hover:bg-gray-700 text-white',
    popular: false,
  },
  pro: {
    tagline: 'Tu clínica vende y reactiva sola',
    pitch: 'Para la clínica con equipo que recibe leads por WhatsApp e Instagram pero no da abasto, y tiene pacientes que no vuelven hace meses.',
    color: 'border-brand-500 ring-2 ring-brand-500',
    ctaClass: 'bg-brand-600 hover:bg-brand-700 text-white',
    popular: true,
  },
  premium: {
    tagline: 'Controla tu ROI. Escala sin límites.',
    pitch: 'Para el centro estético que quiere saber exactamente cuánto genera cada automatización y escalar sin contratar más personal.',
    color: 'border-purple-300 ring-2 ring-purple-400',
    ctaClass: 'bg-purple-700 hover:bg-purple-800 text-white',
    popular: false,
  },
} as const

type CommercialPlan = 'basic' | 'pro' | 'premium'
const COMMERCIAL_PLANS: CommercialPlan[] = ['basic', 'pro', 'premium']

function formatLimit(n: number): string {
  return n === -1 ? 'Ilimitado' : String(n)
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav strip */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-brand-700 font-bold text-lg tracking-tight">
          Paciente IA
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
            Iniciar sesión
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Empezar gratis
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* ── HERO ── */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full border border-brand-100">
            Para clínicas estéticas en Lima
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Tu clínica cita, reactiva<br className="hidden sm:block" /> y cobra sola
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Automatiza confirmaciones, recupera pacientes dormidos y mide tu ROI real.
            Sin contratar más personal.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 pt-2">
            {['14 días gratis', 'Sin tarjeta de crédito', 'Cancela cuando quieras'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> {t}
              </span>
            ))}
          </div>
        </div>

        {/* ── PLAN CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {COMMERCIAL_PLANS.map((key) => {
            const plan = PLAN_CONFIG[key]
            const meta = PLAN_META[key]
            const features = plan.features as readonly PlanFeature[]

            return (
              <div
                key={key}
                className={`relative rounded-2xl border bg-white p-6 flex flex-col gap-5 ${meta.color} ${meta.popular ? 'shadow-xl' : 'shadow-sm'}`}
              >
                {meta.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      ★ Más popular
                    </span>
                  </div>
                )}

                {/* Header */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      S/{plan.price_pen.toLocaleString('es-PE')}
                    </span>
                    <span className="text-sm text-gray-400">/mes</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-800">{meta.tagline}</p>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{meta.pitch}</p>
                </div>

                {/* Limits */}
                <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Usuarios</span>
                    <span className="font-medium">{formatLimit(plan.users)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leads / mes</span>
                    <span className="font-medium">{formatLimit(plan.leads_per_month)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Citas / mes</span>
                    <span className="font-medium">{formatLimit(plan.appointments_per_month)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Flujos n8n</span>
                    <span className="font-medium">{formatLimit(plan.n8n_flows)}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {ALL_FEATURES.map((feature) => {
                    const included = (features as readonly string[]).includes(feature)
                    return (
                      <li
                        key={feature}
                        className={`flex items-start gap-2 text-xs ${included ? 'text-gray-700' : 'text-gray-300'}`}
                      >
                        <span className={`mt-0.5 shrink-0 font-bold ${included ? 'text-green-500' : 'text-gray-200'}`}>
                          {included ? '✓' : '✗'}
                        </span>
                        {FEATURE_LABELS[feature]}
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
                <Link
                  href="/login"
                  className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${meta.ctaClass}`}
                >
                  Empezar 14 días gratis
                </Link>
              </div>
            )
          })}
        </div>

        {/* ── PERFIL POR PLAN ── */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
          <h2 className="text-center text-xl font-bold text-gray-900 mb-8">
            ¿Para quién es cada plan?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            {[
              {
                icon: '💆‍♀️',
                plan: 'Básico',
                profile: 'Cosmetóloga independiente o consultorio de 1 persona',
                win: '3 citas recuperadas/semana = el plan se paga solo en 11 días',
              },
              {
                icon: '🏥',
                plan: 'Pro',
                profile: 'Clínica con 2-3 personas y flujo activo de leads por WhatsApp',
                win: '10 pacientes reactivados = S/3,500 extra al mes vs S/890 del plan',
              },
              {
                icon: '🏢',
                plan: 'Premium',
                profile: 'Centro estético con 5+ staff o potencial de múltiples sedes',
                win: 'ROI dashboard en vivo: cada mes ves exactamente cuánto generaste',
              },
            ].map(({ icon, plan, profile, win }) => (
              <div key={plan} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm space-y-2">
                <div className="text-2xl">{icon}</div>
                <p className="font-semibold text-gray-900">{plan}</p>
                <p className="text-gray-500 text-xs">{profile}</p>
                <p className="text-green-700 text-xs font-medium border-t border-gray-100 pt-2">
                  {win}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── GARANTÍA ── */}
        <div className="text-center space-y-3 py-8 border-y border-gray-100">
          <p className="text-2xl font-bold text-gray-900">
            Si no recuperas el costo en el primer mes, te devolvemos tu dinero.
          </p>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            Estamos tan seguros del valor de PacienteIA para clínicas en Lima que ofrecemos
            garantía completa los primeros 30 días.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-8 py-3 rounded-xl transition-colors"
          >
            Empezar 14 días gratis →
          </Link>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Preguntas frecuentes</h2>
          {[
            {
              q: '¿Puedo cambiar de plan en cualquier momento?',
              a: 'Sí. Puedes subir de plan inmediatamente y el costo se proratea. Para bajar de plan, el cambio aplica desde el siguiente ciclo de facturación.',
            },
            {
              q: '¿Qué pasa si supero el límite mensual?',
              a: 'Te avisamos cuando llegues al 80% de tu límite. Si lo superas, el sistema frena la creación de nuevos registros pero no borra nada. Puedes subir de plan en cualquier momento para continuar.',
            },
            {
              q: '¿Funciona con mi WhatsApp actual?',
              a: 'Sí. PacienteIA se integra con WhatsApp Business API vía n8n. Nuestro equipo te ayuda a configurarlo durante el onboarding.',
            },
            {
              q: '¿Necesito saber de tecnología para usarlo?',
              a: 'No. El dashboard está diseñado para que cualquier persona de la clínica lo maneje. El onboarding inicial lo hacemos juntos en 30 minutos.',
            },
          ].map(({ q, a }) => (
            <details key={q} className="group rounded-xl border border-gray-100 bg-white">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-gray-900 list-none">
                {q}
                <span className="ml-4 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>

      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <p>PacienteIA · Para clínicas estéticas en Lima · contacto@pacienteia.com</p>
      </div>
    </div>
  )
}
