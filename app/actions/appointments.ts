'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/tenant/context'
import { appointmentSchema, type AppointmentFormValues } from '@/lib/validations/appointment'
import type { AppointmentStatus } from '@/types/database'

async function getContext() {
  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  return ctx
}

function mut(client: Awaited<ReturnType<typeof createClient>>) {
  return client as any
}

export async function createAppointment(data: AppointmentFormValues) {
  const { organizationId, branchId } = await getContext()
  const parsed = appointmentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { notes, price, ...rest } = parsed.data
  const supabase = await createClient()

  const { error } = await mut(supabase).from('appointments').insert({
    ...rest,
    organization_id: organizationId,
    branch_id:       branchId,
    notes:           notes || null,
    price:           price ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  redirect('/appointments')
}

export async function updateAppointment(id: string, data: AppointmentFormValues) {
  const { organizationId } = await getContext()
  const parsed = appointmentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { notes, price, ...rest } = parsed.data
  const supabase = await createClient()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ ...rest, notes: notes || null, price: price ?? null })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  revalidatePath(`/appointments/${id}`)
  redirect(`/appointments/${id}`)
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const { organizationId } = await getContext()
  const supabase = await createClient()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  revalidatePath('/patients')
  revalidatePath('/dashboard')
}

export async function saveAppointmentNotes(
  id: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const { organizationId } = await getContext()
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const supabase = await createClient()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ notes })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/appointments/${id}`)
  return { ok: true }
}

export async function cancelAppointment(id: string): Promise<void> {
  const { organizationId } = await getContext()
  const supabase = await createClient()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) console.error('[cancelAppointment]', error.message)

  revalidatePath('/appointments')
  revalidatePath('/dashboard')
}
