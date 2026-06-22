import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { redirect }          from 'next/navigation'
import { revalidatePath }    from 'next/cache'
import { encryptToken }      from '@/lib/crypto/whatsapp-token'
import CopyButton            from './CopyButton'

const WEBHOOK_URL = 'https://app.pacienteia.com/api/whatsapp/webhook'

async function saveGoogleReviewUrl(organizationId: string, branchId: string, url: string) {
  'use server'
  const sb = createAdminClient() as any
  await sb
    .from('branch_whatsapp_config')
    .update({ google_review_url: url || null })
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .eq('status', 'active')
  revalidatePath('/settings/whatsapp')
}

async function saveAppSecret(organizationId: string, branchId: string, secret: string) {
  'use server'
  if (!secret.trim()) return
  const sb = createAdminClient() as any
  const enc = encryptToken(secret.trim())
  await sb
    .from('branch_whatsapp_config')
    .update({ app_secret_enc: enc })
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .eq('status', 'active')
  revalidatePath('/settings/whatsapp')
}

export default async function WhatsAppSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx?.organizationId) redirect('/org-selector')

  const sb = createAdminClient() as any

  const { data: configs } = await sb
    .from('branch_whatsapp_config')
    .select('id, branch_id, display_name, phone_number_id, status, google_review_url, app_secret_enc, created_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at')

  const active       = (configs ?? []).filter((c: any) => c.status === 'active')
  const verifyToken  = process.env.WHATSAPP_VERIFY_TOKEN ?? '—'

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">WhatsApp Business</h1>
        <p className="text-sm text-slate mt-1">
          Conecta el número de WhatsApp de tu sucursal con PacienteIA.
        </p>
      </div>

      {/* Webhook config — datos que la clínica pega en su Meta */}
      <div className="bg-mist rounded-2xl border border-fog p-5 space-y-4">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide">
          Configuración en Meta — pega estos datos en tu app
        </p>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate mb-1">URL de devolución de llamada (Webhook)</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-sm text-brand-700 bg-white border border-fog rounded-xl px-3 py-2 break-all">
                {WEBHOOK_URL}
              </p>
              <CopyButton value={WEBHOOK_URL} />
            </div>
            <p className="text-[11px] text-slate mt-1">
              Meta → tu app → WhatsApp → Configuración → Webhooks → URL de devolución de llamada
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate mb-1">Token de verificación</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-sm text-ink bg-white border border-fog rounded-xl px-3 py-2 break-all">
                {verifyToken}
              </p>
              <CopyButton value={verifyToken} />
            </div>
            <p className="text-[11px] text-slate mt-1">
              Meta → tu app → WhatsApp → Configuración → Webhooks → Token de verificación
            </p>
          </div>
        </div>

        <div className="border-t border-fog pt-3 space-y-1">
          <p className="text-xs text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Pasos para configurar en Meta:</p>
          <ol className="space-y-0.5 text-xs text-slate list-decimal list-inside">
            <li>Pega la URL y el token de verificación en tu app de Meta</li>
            <li>Suscríbete al campo <code className="bg-[#F3F6F9] px-1 rounded">messages</code></li>
            <li>Copia tu App Secret desde Meta → tu app → Configuración → Básica</li>
            <li>Pégalo en el campo "App Secret" del número conectado abajo</li>
          </ol>
        </div>
      </div>

      {/* Connected numbers */}
      {active.length > 0 ? (
        <div className="space-y-4">
          {active.map((c: any) => {
            const saveSecret      = saveAppSecret.bind(null, ctx.organizationId, c.branch_id)
            const saveReviewUrl   = saveGoogleReviewUrl.bind(null, ctx.organizationId, c.branch_id)
            const hasSecret       = !!c.app_secret_enc

            return (
              <div key={c.id} className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{c.display_name ?? 'Número sin nombre'}</p>
                    <p className="text-xs text-slate mt-0.5">Phone Number ID: {c.phone_number_id}</p>
                  </div>
                  <span className="text-xs font-medium bg-lima-100 text-lima-700 px-2.5 py-1 rounded-full">
                    Activo
                  </span>
                </div>

                {/* App Secret */}
                <div className="border-t border-fog pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">App Secret de Meta</p>
                      <p className="text-xs text-slate mt-0.5">
                        Meta → tu app → Configuración → Básica → App Secret
                      </p>
                    </div>
                    {hasSecret ? (
                      <span className="text-[11px] font-medium bg-lima-100 text-lima-700 px-2 py-0.5 rounded-full">
                        ✓ Configurado
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <form
                    action={async (formData: FormData) => {
                      'use server'
                      const secret = (formData.get('app_secret') as string ?? '').trim()
                      await saveSecret(secret)
                    }}
                    className="flex gap-2"
                  >
                    <input
                      name="app_secret"
                      type="password"
                      placeholder={hasSecret ? '••••••••••••••••••••••••••••••••' : 'Pega tu App Secret aquí'}
                      className="flex-1 border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300 font-mono"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors whitespace-nowrap"
                    >
                      Guardar
                    </button>
                  </form>
                  {!hasSecret && (
                    <p className="text-[11px] text-amber-600">
                      Sin App Secret configurado — los mensajes entrantes usarán la clave global de PacienteIA.
                      Configúralo para usar tu propia app de Meta.
                    </p>
                  )}
                </div>

                {/* Google Review URL */}
                <div className="border-t border-fog pt-4 space-y-3">
                  <div>
                    <p className="text-xs text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">URL de Google Reviews</p>
                    <p className="text-xs text-slate mt-0.5">
                      Se envía a pacientes que califican 4–5 estrellas en la encuesta post-cita.
                    </p>
                  </div>
                  <form
                    action={async (formData: FormData) => {
                      'use server'
                      const url = (formData.get('google_review_url') as string ?? '').trim()
                      await saveReviewUrl(url)
                    }}
                    className="flex gap-2"
                  >
                    <input
                      name="google_review_url"
                      type="url"
                      defaultValue={c.google_review_url ?? ''}
                      placeholder="https://g.page/r/tu-clinica/review"
                      className="flex-1 border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
                    >
                      Guardar
                    </button>
                  </form>
                  {c.google_review_url ? (
                    <p className="text-[11px] text-lima-600">✓ Configurado</p>
                  ) : (
                    <p className="text-[11px] text-amber-600">
                      Sin configurar — pacientes con 4–5 estrellas recibirán gracias pero sin link de reseña.
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-fog p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate">No hay números conectados</p>
          <p className="text-xs text-slate">
            Configura el webhook en Meta y agrega tus credenciales para conectar tu número de WhatsApp.
          </p>
          <a
            href="/onboarding?step=3"
            className="inline-block mt-2 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            Ir al asistente de configuración →
          </a>
        </div>
      )}
    </div>
  )
}
