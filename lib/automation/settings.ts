// Shared utility to check if an automation is enabled for a branch.
// Returns true when the row doesn't exist (default: enabled) or is_enabled=true.

import { createAdminClient } from '@/lib/supabase/admin'

export type AutomationKey =
  | 'reminders_24h'
  | 'reminders_2h'
  | 'appointment_followups'
  | 'reactivation'
  | 'flash_offers'
  | 'smart_buffer'
  | 'roi_report'
  | 'reschedule_escalation'

export const AUTOMATION_LABELS: Record<AutomationKey, { name: string; desc: string }> = {
  reminders_24h:           { name: 'Recordatorio 24h',        desc: 'WhatsApp automático 24h antes de cada cita' },
  reminders_2h:            { name: 'Recordatorio 2h',         desc: 'WhatsApp automático 2h antes de cada cita' },
  appointment_followups:   { name: 'Encuesta post-cita',      desc: 'Encuesta de satisfacción 4-10h después de la atención' },
  reactivation:            { name: 'Reactivación',            desc: 'Campaña para pacientes inactivos >90 días (2 pasos)' },
  flash_offers:            { name: 'Ofertas flash',           desc: 'Oferta de descuento para llenar slots vacíos del día siguiente' },
  smart_buffer:            { name: 'Smart Buffer',            desc: 'Aviso de retraso automático al siguiente paciente cuando el doctor se pasa' },
  roi_report:              { name: 'Reporte ROI semanal',     desc: 'Resumen semanal enviado por WhatsApp al dueño cada lunes' },
  reschedule_escalation:   { name: 'Escalación reagendamiento', desc: 'Tarea copilot si el paciente no elige slot de reagendamiento en 2h' },
}

export async function isAutomationEnabled(
  organizationId: string,
  branchId: string,
  key: AutomationKey,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('automation_settings')
    .select('is_enabled')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .eq('automation_key', key)
    .maybeSingle()

  return data === null ? true : (data.is_enabled as boolean)
}
