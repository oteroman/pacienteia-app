import { redirect }           from 'next/navigation'
import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { getActiveContext }   from '@/lib/tenant/context'
import { savePaymentSettings } from '@/app/actions/payment-settings'

const METHOD_OPTIONS = [
  {
    value: 'none',
    label: 'Sin cobro de separación',
    desc:  'No se solicita pago al confirmar cita. Flujo estándar.',
    icon:  '⛔',
  },
  {
    value: 'qr_image',
    label: 'QR Yape / Plin (manual)',
    desc:  'Envía tu QR por WhatsApp. El staff confirma el pago al recibir el comprobante.',
    icon:  '📷',
  },
  {
    value: 'niubiz',
    label: 'Link de pago Niubiz',
    desc:  'Genera un link de pago automático. Acepta tarjeta, Yape y Plin. Confirmación automática vía webhook.',
    icon:  '💳',
  },
] as const

export default async function PaymentSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) redirect('/org-selector')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: config } = await sb
    .from('branch_whatsapp_config')
    .select('payment_method, payment_deposit_amount, payment_qr_image_url, niubiz_merchant_id, niubiz_client_id_enc, niubiz_client_secret_enc')
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
    .eq('status', 'active')
    .single()

  const current = config ?? {}
  const method  = (current.payment_method ?? 'none') as 'none' | 'qr_image' | 'niubiz'
  const hasClientId     = !!current.niubiz_client_id_enc
  const hasClientSecret = !!current.niubiz_client_secret_enc

  const niubizWebhookUrl = 'https://app.pacienteia.com/api/webhooks/niubiz'

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Pago de Separación</h1>
        <p className="text-sm text-slate mt-1">
          Cobra una separación al confirmar cita. Reduce no-shows significativamente.
        </p>
      </div>

      <form action={savePaymentSettings} className="space-y-6">
        {/* Method selector */}
        <div className="space-y-3">
          <p className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Método de cobro</p>
          {METHOD_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-4 rounded-2xl border border-fog cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
            >
              <input
                type="radio"
                name="payment_method"
                value={opt.value}
                defaultChecked={method === opt.value}
                className="mt-0.5 accent-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-ink">{opt.icon} {opt.label}</p>
                <p className="text-xs text-slate mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Deposit amount */}
        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate" htmlFor="deposit_amount">
            Monto de separación (S/)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate text-sm">S/</span>
            <input
              id="deposit_amount"
              type="number"
              name="payment_deposit_amount"
              min={10}
              max={500}
              defaultValue={current.payment_deposit_amount ?? 50}
              className="w-28 border border-fog rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <p className="text-xs text-slate">Se aplica a ambas opciones de cobro.</p>
        </div>

        {/* QR Image section */}
        <div className="rounded-2xl border border-fog p-5 space-y-4">
          <p className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">QR Yape / Plin — Configuración</p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate" htmlFor="qr_url">
              URL pública de tu imagen QR
            </label>
            <input
              id="qr_url"
              type="url"
              name="payment_qr_image_url"
              defaultValue={current.payment_qr_image_url ?? ''}
              placeholder="https://..."
              className="w-full border border-fog rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <p className="text-[11px] text-slate">
              Sube tu QR a Google Drive, Imgur o Dropbox y pega el link directo a la imagen.
              Debe ser accesible públicamente (WhatsApp la descarga al enviarla).
            </p>
          </div>

          {current.payment_qr_image_url && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.payment_qr_image_url}
                alt="QR configurado"
                className="w-20 h-20 rounded-xl border border-fog object-contain"
              />
              <p className="text-xs text-lima-600 font-medium">QR cargado correctamente</p>
            </div>
          )}
        </div>

        {/* Niubiz section */}
        <div className="rounded-2xl border border-fog p-5 space-y-4">
          <p className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Niubiz — Configuración</p>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate" htmlFor="merchant_id">
                Merchant ID (número de comercio)
              </label>
              <input
                id="merchant_id"
                type="text"
                name="niubiz_merchant_id"
                defaultValue={current.niubiz_merchant_id ?? ''}
                placeholder="522591234"
                className="w-full border border-fog rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate" htmlFor="client_id">
                Client ID {hasClientId && <span className="text-lima-600">✓ guardado</span>}
              </label>
              <input
                id="client_id"
                type="password"
                name="niubiz_client_id"
                placeholder={hasClientId ? '(dejar vacío para mantener el actual)' : 'Client ID de tu cuenta Niubiz'}
                className="w-full border border-fog rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate" htmlFor="client_secret">
                Client Secret {hasClientSecret && <span className="text-lima-600">✓ guardado</span>}
              </label>
              <input
                id="client_secret"
                type="password"
                name="niubiz_client_secret"
                placeholder={hasClientSecret ? '(dejar vacío para mantener el actual)' : 'Client Secret de tu cuenta Niubiz'}
                className="w-full border border-fog rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate">URL de Webhook (pégala en tu consola Niubiz)</p>
              <p className="font-mono text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 break-all">
                {niubizWebhookUrl}
              </p>
              <p className="text-[11px] text-slate">
                Configura esta URL en tu cuenta Niubiz para recibir confirmaciones automáticas de pago.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-2xl transition-colors text-sm"
        >
          Guardar configuración de pagos
        </button>
      </form>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-amber-800">¿Cómo funciona el flujo de pago?</p>
        <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
          <li>El paciente confirma su cita (recordatorio "1" o auto-agendamiento por WhatsApp)</li>
          <li>El sistema envía automáticamente el QR o el link de pago por WhatsApp</li>
          <li><strong>QR Yape/Plin:</strong> el paciente manda el comprobante → staff marca como pagado manualmente en la ficha de la cita</li>
          <li><strong>Niubiz:</strong> el paciente paga en el link → confirmación automática sin intervención del staff</li>
          <li>Citas sin pago confirmado en 6h generan una tarea en Copiloto para seguimiento</li>
        </ul>
      </div>
    </div>
  )
}
