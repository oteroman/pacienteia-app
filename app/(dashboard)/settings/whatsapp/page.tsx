import { createClient }      from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { redirect }          from 'next/navigation'

const WEBHOOK_URL = 'https://app.pacienteia.com/api/whatsapp/webhook'

export default async function WhatsAppSettingsPage() {
  const supabase = await createClient()
  const orgId    = await getActiveClinicId()
  if (!orgId) redirect('/org-selector')

  const { data: configs } = await supabase
    .from('branch_whatsapp_config')
    .select('id, display_name, phone_number_id, status, created_at')
    .eq('organization_id', orgId)
    .order('created_at')

  const active = configs?.filter((c) => c.status === 'active') ?? []

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conecta el número de WhatsApp de tu sucursal para recibir y enviar mensajes automáticamente.
        </p>
      </div>

      {/* Webhook info */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          URL de Webhook — pégala en Meta Business Suite
        </p>
        <p className="font-mono text-sm text-brand-700 break-all select-all">{WEBHOOK_URL}</p>
        <p className="text-xs text-gray-400">
          Meta → WhatsApp → Configuración → Webhooks → URL de devolución de llamada
        </p>
      </div>

      {/* Connected numbers */}
      {active.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {active.map((c) => (
            <div key={c.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.display_name ?? 'Número sin nombre'}</p>
                <p className="text-xs text-gray-400 mt-0.5">ID: {c.phone_number_id}</p>
              </div>
              <span className="text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                Activo
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center space-y-3">
          <p className="text-sm font-medium text-gray-600">No hay números conectados</p>
          <p className="text-xs text-gray-400">
            Para conectar WhatsApp necesitas un número verificado en Meta Business Suite
            y las credenciales de la API de WhatsApp Business.
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
