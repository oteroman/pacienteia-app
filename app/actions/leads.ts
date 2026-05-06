'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import type { TablesInsert, LeadEvent } from '@/types/database'

function mut(client: Awaited<ReturnType<typeof createClient>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any
}

export async function convertLeadToPatient(leadId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return
  const supabase = await createClient()

  const { data: leadData } = await supabase
    .from('lead_events')
    .select('*')
    .eq('id', leadId)
    .eq('clinic_id', clinicId)
    .single()
  if (!leadData) return
  const lead = leadData as LeadEvent

  const payload = (lead.payload ?? {}) as Record<string, string>
  const phone = payload.phone ?? ''

  const patientData: TablesInsert<'patients'> = {
    clinic_id: clinicId,
    full_name: phone ? `Lead ${phone.slice(-4)}` : 'Lead sin nombre',
    phone: phone || null,
    status: 'lead',
  }

  const { data: patient } = await mut(supabase)
    .from('patients')
    .insert(patientData)
    .select()
    .single()

  if (patient?.id) {
    await mut(supabase)
      .from('lead_events')
      .update({ patient_id: patient.id })
      .eq('id', leadId)
  }

  revalidatePath('/leads')
}

export async function archiveLead(leadId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return
  const supabase = await createClient()

  await mut(supabase)
    .from('lead_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('clinic_id', clinicId)

  revalidatePath('/leads')
}
