'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'

function mut(client: Awaited<ReturnType<typeof createClient>>) {
  return client as any
}

export async function convertLeadToPatient(leadId: string): Promise<void> {
  const orgId = await getActiveClinicId()
  if (!orgId) return
  const supabase = await createClient()

  const { data: intake } = await (supabase as any)
    .from('intakes')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', orgId)
    .single()
  if (!intake) return

  const phone = intake.contact_phone ?? null

  const { data: patient } = await mut(supabase)
    .from('patients')
    .insert({
      organization_id: orgId,
      full_name: phone ? `Lead ${String(phone).slice(-4)}` : 'Lead sin nombre',
      phone: phone || null,
      status: 'lead',
    })
    .select()
    .single()

  if (patient?.id) {
    await mut(supabase)
      .from('intakes')
      .update({ patient_id: patient.id })
      .eq('id', leadId)
  }

  revalidatePath('/leads')
}

export async function archiveLead(leadId: string): Promise<void> {
  const orgId = await getActiveClinicId()
  if (!orgId) return
  const supabase = await createClient()

  await mut(supabase)
    .from('intakes')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('organization_id', orgId)

  revalidatePath('/leads')
}
