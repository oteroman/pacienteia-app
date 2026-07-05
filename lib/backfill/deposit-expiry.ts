/**
 * No-show blindado — libera cupos cuya separación (depósito) no se pagó a tiempo.
 *
 * Una cita con `payment_status = 'pending'` cuya separación se solicitó hace más
 * de DEPOSIT_TTL_HOURS y sigue sin pagarse se considera NO confirmada: se libera
 * el cupo (cita → cancelled), se ofrece a la lista de recuperación (triggerBackfill)
 * y se avisa al paciente con un mensaje operativo de cortesía.
 *
 * Idempotente: al marcar `payment_status = 'expired'` la cita deja de calificar.
 */

import { createAdminClient }    from '@/lib/supabase/admin'
import { sendWhatsAppText }     from '@/lib/whatsapp/send'
import { firstNameOf }          from '@/lib/whatsapp/reminders'
import { isAutomationEnabled }  from '@/lib/automation/settings'
import { triggerBackfill }      from './index'

// Ventana de gracia para pagar la separación antes de liberar el cupo.
export const DEPOSIT_TTL_HOURS = 2

interface ExpiredRow {
  id:              string
  organization_id: string
  branch_id:       string | null
  treatment_type:  string
  scheduled_at:    string
  patients:        { full_name: string | null; phone: string | null } | null
}

export interface DepositExpiryResult {
  organizationId: string
  released:       number
  skipped:        number
}

export async function releaseExpiredDepositsForOrg(organizationId: string): Promise<DepositExpiryResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const cutoff = new Date(Date.now() - DEPOSIT_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data: rows } = await sb
    .from('appointments')
    .select('id, organization_id, branch_id, treatment_type, scheduled_at, patients(full_name, phone)')
    .eq('organization_id', organizationId)
    .eq('payment_status', 'pending')
    .lt('payment_requested_at', cutoff)
    .in('status', ['scheduled', 'confirmed'])
    .limit(200)

  let released = 0
  let skipped  = 0

  for (const row of ((rows ?? []) as ExpiredRow[])) {
    // Opt-in: solo actúa si el dueño ACTIVÓ explícitamente el automatismo para
    // esa sucursal (default OFF — no cancela citas sin habilitación expresa).
    if (row.branch_id && !(await isAutomationEnabled(organizationId, row.branch_id, 'deposit_expiry', false))) {
      skipped++
      continue
    }

    // Libera el cupo: la separación venció → la cita no se confirmó.
    await sb
      .from('appointments')
      .update({ payment_status: 'expired', status: 'cancelled' })
      .eq('id', row.id)
      .eq('organization_id', organizationId)

    // Ofrece el cupo a la lista de recuperación (reusa el motor de backfill).
    await triggerBackfill({
      organizationId,
      branchId:      row.branch_id ?? undefined,
      appointmentId: row.id,
      treatmentType: row.treatment_type,
      slotStart:     row.scheduled_at,
      reasonOpened:  'cancellation',
    })

    // Cortesía operativa al paciente cuyo cupo se liberó (sin consejo médico).
    const phone = row.patients?.phone
    if (row.branch_id && phone) {
      const firstName = firstNameOf(row.patients?.full_name ?? phone)
      const body =
        `Hola ${firstName} 👋 No pudimos confirmar tu reserva de *${row.treatment_type}* ` +
        `porque no recibimos la separación a tiempo, así que el cupo quedó liberado.\n\n` +
        `Si aún deseas atenderte, escríbenos por aquí y con gusto te reagendamos 😊`
      try {
        await sendWhatsAppText({ branchId: row.branch_id, to: phone, body })
      } catch (err) {
        console.error('[deposit-expiry] courtesy WA failed for', phone, err)
      }
    }

    released++
  }

  return { organizationId, released, skipped }
}
