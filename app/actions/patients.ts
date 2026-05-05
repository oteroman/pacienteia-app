'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { patientSchema, type PatientFormValues } from '@/lib/validations/patient'

async function getClinicId() {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')
  return clinicId
}

export async function createPatient(data: PatientFormValues) {
  const clinicId = await getClinicId()
  const parsed = patientSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { phone, email, dni, notes, photo_url, last_visit_date, ...rest } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('patients').insert({
    ...rest,
    clinic_id:       clinicId,
    phone:           phone   || null,
    email:           email   || null,
    dni:             dni     || null,
    notes:           notes   || null,
    photo_url:       photo_url || null,
    last_visit_date: last_visit_date || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/patients')
  redirect('/patients')
}

export async function updatePatient(id: string, data: PatientFormValues) {
  const clinicId = await getClinicId()
  const parsed = patientSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { phone, email, dni, notes, photo_url, last_visit_date, ...rest } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('patients')
    .update({
      ...rest,
      phone:           phone   || null,
      email:           email   || null,
      dni:             dni     || null,
      notes:           notes   || null,
      photo_url:       photo_url || null,
      last_visit_date: last_visit_date || null,
    })
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  revalidatePath(`/patients/${id}`)
  redirect(`/patients/${id}`)
}

export async function softDeletePatient(id: string) {
  const clinicId = await getClinicId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('patients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', clinicId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  redirect('/patients')
}
