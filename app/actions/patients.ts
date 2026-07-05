'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { getActiveOrganizationId } from '@/lib/tenant/context'
import { patientSchema, type PatientFormValues } from '@/lib/validations/patient'

async function getOrgId() {
  const orgId = await getActiveClinicId()
  if (!orgId) redirect('/org-selector')
  return orgId
}

function mut(client: Awaited<ReturnType<typeof createClient>>) {
  return client as any
}

export async function createPatient(data: PatientFormValues) {
  const orgId = await getOrgId()
  const parsed = patientSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { phone, email, dni, notes, contraindications, photo_url, last_visit_date, ...rest } = parsed.data as any
  const supabase = await createClient()

  const { error } = await mut(supabase).from('patients').insert({
    ...rest,
    organization_id:  orgId,
    phone:            phone   || null,
    email:            email   || null,
    dni:              dni     || null,
    notes:            notes   || null,
    contraindications: contraindications || null,
    photo_url:        photo_url || null,
    last_visit_date:  last_visit_date || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/patients')
  redirect('/patients')
}

export async function updatePatient(id: string, data: PatientFormValues) {
  const orgId = await getOrgId()
  const parsed = patientSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { phone, email, dni, notes, contraindications, photo_url, last_visit_date, ...rest } = parsed.data as any
  const supabase = await createClient()

  const { error } = await mut(supabase)
    .from('patients')
    .update({
      ...rest,
      phone:            phone   || null,
      email:            email   || null,
      dni:              dni     || null,
      notes:            notes   || null,
      contraindications: contraindications || null,
      photo_url:        photo_url || null,
      last_visit_date:  last_visit_date || null,
    })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/patients')
  revalidatePath(`/patients/${id}`)
  redirect(`/patients/${id}`)
}

export async function addPatientPhoto(
  patientId: string,
  photoUrl: string,
  type: 'before' | 'after' | 'general',
  label?: string,
): Promise<{ error?: string }> {
  const orgId = await getActiveOrganizationId()
  if (!orgId) return { error: 'Sin organización activa' }

  const sb = createAdminClient() as any
  const { error } = await sb.from('patient_photos').insert({
    organization_id: orgId,
    patient_id:      patientId,
    photo_url:       photoUrl,
    type,
    label:           label || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/patients/${patientId}`)
  return {}
}

export async function deletePatientPhoto(photoId: string, patientId: string): Promise<void> {
  const orgId = await getActiveOrganizationId()
  if (!orgId) return

  const sb = createAdminClient() as any
  await sb.from('patient_photos').delete().eq('id', photoId).eq('organization_id', orgId)
  revalidatePath(`/patients/${patientId}`)
}

export async function softDeletePatient(id: string): Promise<void> {
  const orgId = await getOrgId()
  const supabase = await createClient()

  const { error } = await mut(supabase)
    .from('patients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) { console.error('[softDeletePatient]', error.message); return }
  revalidatePath('/patients')
  redirect('/patients')
}
