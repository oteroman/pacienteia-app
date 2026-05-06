'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { appointmentSchema, type AppointmentFormValues } from '@/lib/validations/appointment'
import type { AppointmentStatus, TablesInsert, TablesUpdate } from '@/types/database'

async function getClinicId() {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')
  return clinicId
}

// Supabase JS 2.x + TS 5.8: conditional type `Relation extends {Insert}` is deferred
// through indexed access chains, making Row=never. Data is pre-typed via TablesInsert/Update.
function mut(client: Awaited<ReturnType<typeof createClient>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any
}

export async function createAppointment(data: AppointmentFormValues) {
  const clinicId = await getClinicId()
  const parsed = appointmentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { notes, price, ...rest } = parsed.data
  const supabase = await createClient()

  const insertData: TablesInsert<'appointments'> = {
    ...rest,
    clinic_id: clinicId,
    notes:     notes || null,
    price:     price ?? null,
  }

  const { error } = await mut(supabase).from('appointments').insert(insertData)

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  redirect('/appointments')
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const clinicId = await getClinicId()
  const supabase = await createClient()

  const updateData: TablesUpdate<'appointments'> = { status }

  const { error } = await mut(supabase)
    .from('appointments')
    .update(updateData)
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  revalidatePath('/dashboard')
}

export async function cancelAppointment(id: string): Promise<void> {
  const clinicId = await getClinicId()
  const supabase = await createClient()

  const cancelData: TablesUpdate<'appointments'> = { status: 'cancelled' }
  const workflowData: TablesInsert<'workflow_runs'> = {
    clinic_id:   clinicId,
    event_type:  'appointment.cancelled',
    entity_type: 'appointment',
    entity_id:   id,
    status:      'pending',
    payload:     { appointment_id: id },
  }

  const [aptRes, wfRes] = await Promise.all([
    mut(supabase).from('appointments').update(cancelData).eq('id', id).eq('clinic_id', clinicId),
    mut(supabase).from('workflow_runs').insert(workflowData),
  ])

  if (aptRes.error) console.error('[cancelAppointment]', aptRes.error.message)
  if (wfRes.error)  console.error('[workflow_run] insert failed:', wfRes.error.message)

  revalidatePath('/appointments')
  revalidatePath('/dashboard')
}
