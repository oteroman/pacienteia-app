'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { patientSchema, type PatientFormValues } from '@/lib/validations/patient'
import type { TablesInsert, TablesUpdate } from '@/types/database'

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

export async function createPatient(data: PatientFormValues) {
  const clinicId = await getClinicId()
  const parsed = patientSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { phone, email, dni, notes, photo_url, last_visit_date, ...rest } = parsed.data
  const supabase = await createClient()

  const insertData: TablesInsert<'patients'> = {
    ...rest,
    clinic_id:       clinicId,
    phone:           phone   || null,
    email:           email   || null,
    dni:             dni     || null,
    notes:           notes   || null,
    photo_url:       photo_url || null,
    last_visit_date: last_visit_date || null,
  }

  const { error } = await mut(supabase).from('patients').insert(insertData)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  redirect('/patients')
}

export async function updatePatient(id: string, data: PatientFormValues) {
  const clinicId = await getClinicId()
  const parsed = patientSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { phone, email, dni, notes, photo_url, last_visit_date, ...rest } = parsed.data
  const supabase = await createClient()

  const updateData: TablesUpdate<'patients'> = {
    ...rest,
    phone:           phone   || null,
    email:           email   || null,
    dni:             dni     || null,
    notes:           notes   || null,
    photo_url:       photo_url || null,
    last_visit_date: last_visit_date || null,
  }

  const { error } = await mut(supabase)
    .from('patients')
    .update(updateData)
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  revalidatePath(`/patients/${id}`)
  redirect(`/patients/${id}`)
}

export async function softDeletePatient(id: string): Promise<void> {
  const clinicId = await getClinicId()
  const supabase = await createClient()

  const deleteData: TablesUpdate<'patients'> = { deleted_at: new Date().toISOString() }

  const { error } = await mut(supabase)
    .from('patients')
    .update(deleteData)
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) { console.error('[softDeletePatient]', error.message); return }
  revalidatePath('/patients')
  redirect('/patients')
}
