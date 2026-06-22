import { redirect }          from 'next/navigation'
import { getActiveContext }  from '@/lib/tenant/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveWaPhone }       from '@/app/actions/waiting-room'

export const dynamic = 'force-dynamic'

export default async function WaitingRoomSettingsPage() {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) redirect('/org-selector')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: cfg } = await sb
    .from('branch_whatsapp_config')
    .select('wa_phone, display_name')
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
    .eq('status', 'active')
    .maybeSingle()

  const waPhone: string = cfg?.wa_phone ?? ''

  // QR encodes a WhatsApp deep link pre-filled with "Sala de espera"
  const waLink    = waPhone ? `https://wa.me/${waPhone.replace(/\D/g, '')}?text=Sala+de+espera` : null
  const qrDataUrl = waLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(waLink)}`
    : null

  return (
    <div className="space-y-8 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-ink">Sala de Espera — Configuración</h1>
        <p className="text-sm text-slate mt-0.5">
          Genera un QR para que los pacientes registren su llegada vía WhatsApp.
        </p>
      </div>

      {/* Phone config */}
      <div className="rounded-xl border border-fog bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink">Número de WhatsApp de la clínica</h3>
        <p className="text-xs text-slate">
          Ingresa el número en formato internacional sin espacios ni guiones (ej: <strong>51987654321</strong> para Perú).
          Este es el número al que los pacientes enviarán el mensaje al escanear el QR.
        </p>
        <form action={saveWaPhone} className="flex gap-3">
          <input
            type="text"
            name="wa_phone"
            defaultValue={waPhone}
            placeholder="51987654321"
            className="flex-1 border border-fog rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Guardar
          </button>
        </form>
      </div>

      {/* QR code */}
      {qrDataUrl ? (
        <div className="rounded-xl border border-fog bg-white p-6 flex flex-col items-center gap-4">
          <h3 className="text-sm font-semibold text-ink self-start">QR para imprimir en recepción</h3>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR sala de espera"
            width={280}
            height={280}
            className="rounded-lg border border-fog"
          />

          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-ink">Escanea para unirte a la sala de espera</p>
            {cfg?.display_name && (
              <p className="text-xs text-slate">{cfg.display_name}</p>
            )}
          </div>

          <a
            href={qrDataUrl}
            download="qr-sala-espera.png"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:text-brand-700 font-medium underline"
          >
            Descargar imagen para imprimir
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-fog bg-mist/30 px-4 py-10 text-center text-sm text-slate">
          Configura el número de WhatsApp arriba para generar el QR.
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-fog bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">¿Cómo funciona?</h3>
        <ol className="space-y-2 text-sm text-slate list-decimal list-inside">
          <li>Imprime el QR y colócalo en la recepción o sala de espera.</li>
          <li>El paciente escanea el QR con su cámara → se abre WhatsApp con el mensaje listo.</li>
          <li>Al enviarlo, el sistema registra al paciente en la cola y le responde con su posición.</li>
          <li>Desde <strong>/waiting-room</strong> ves la cola en tiempo real y puedes llamar a cada paciente.</li>
          <li>Al presionar <strong>Llamar</strong>, el paciente recibe un WhatsApp avisándole que es su turno.</li>
        </ol>
      </div>

    </div>
  )
}
