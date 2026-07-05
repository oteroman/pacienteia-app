'use server'

import { getActiveContext }    from '@/lib/tenant/context'
import { createAdminClient }   from '@/lib/supabase/admin'
import { sendWhatsAppText }    from '@/lib/whatsapp/send'

export async function notifyOpportunityViaWA(
  patientId:     string,
  patientName:   string,
  phone:         string,
  treatmentType: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Sin contexto activo' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Fetch clinic name for personalization
  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', ctx.organizationId)
    .single()
  const clinicName = org?.name ?? 'la clínica'

  const firstName = (patientName ?? '').split(' ')[0]

  const body =
    `Hola ${firstName} 👋 Desde *${clinicName}* te contactamos porque ya es momento de tu próximo *${treatmentType}*.\n\n` +
    `¿Te gustaría agendar una cita? Dinos tu disponibilidad y te ayudamos enseguida 😊`

  const result = await sendWhatsAppText({ branchId: ctx.branchId, to: phone, body })

  if (result.error) {
    return { ok: false, error: result.error }
  }
  return { ok: true }
}
