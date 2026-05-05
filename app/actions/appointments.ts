'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { appointmentSchema, type AppointmentFormValues } from '@/lib/validations/appointment'
import type { AppointmentStatus } from '@/types/database'

async function getClinicId() {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')
  return clinicId
}

export async function createAppointment(data: AppointmentFormValues) {
  const clinicId = await getClinicId()
  const parsed = appointmentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { notes, price, ...rest } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('appointments').insert({
    ...rest,
    clinic_id: clinicId,
    notes:     notes || null,
    price:     price ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  redirect('/appointments')
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const clinicId = await getClinicId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  revalidatePath('/dashboard')
}

export async function cancelAppointment(id: string) {
  const clinicId = await getClinicId()
  const supabase = await createClient()

  // Cancel appointment + log workflow run in parallel
  const [aptRes, wfRes] = await Promise.all([
    supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('clinic_id', clinicId),
    supabase.from('workflow_runs').insert({
      clinic_id:   clinicId,
      event_type:  'appointment.cancelled',
      entity_type: 'appointment',
      entity_id:   id,
      status:      'pending',
      payload:     { appointment_id: id },
    }),
  ])

  if (aptRes.error) return { error: aptRes.error.message }
  if (wfRes.error)  console.error('[workflow_run] insert failed:', wfRes.error.message)

  revalidatePath('/appointments')
  revalidatePath('/dashboard')
}
