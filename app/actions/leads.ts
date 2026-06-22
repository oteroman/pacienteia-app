'use server'
import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createClient }   from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { getActiveContext }  from '@/lib/tenant/context'
import { processIntake }     from '@/app/actions/intake'

function mut(client: Awaited<ReturnType<typeof createClient>>) {
  return client as any
}

export async function createManualLead(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const ctx = await getActiveContext()
  if (!ctx) return { error: 'Sesión expirada' }

  const contactName  = (formData.get('contact_name')  as string)?.trim()
  const contactPhone = (formData.get('contact_phone') as string)?.trim()
  const contactEmail = (formData.get('contact_email') as string)?.trim() || undefined
  const rawContent   = (formData.get('notes')         as string)?.trim()
  const channel      = (formData.get('channel')       as string) || 'manual'

  if (!contactName)  return { error: 'El nombre es requerido' }
  if (!contactPhone) return { error: 'El teléfono es requerido' }
  if (!rawContent)   return { error: 'Escribe de qué consulta el paciente' }

  const content = `${contactName} (${contactPhone}): ${rawContent}`

  await processIntake({
    organizationId: ctx.organizationId,
    branchId:       ctx.branchId,
    channel:        channel as any,
    contactName,
    contactPhone,
    contactEmail,
    rawContent:     content,
  })

  revalidatePath('/leads')
  redirect('/leads')
}

export async function convertLeadToPatient(leadId: string): Promise<void> {
  const orgId = await getActiveClinicId()
  if (!orgId) return
  const sb = createAdminClient() as any

  const { data: intake } = await sb
    .from('intakes')
    .select('contact_name, contact_phone, contact_email, patient_id')
    .eq('id', leadId)
    .eq('organization_id', orgId)
    .single()
  if (!intake) return
  if (intake.patient_id) return  // already linked

  const phone    = intake.contact_phone ?? null
  const fullName = intake.contact_name?.trim()
    || (phone ? `Paciente ${String(phone).slice(-4)}` : 'Paciente sin nombre')

  const { data: patient } = await sb
    .from('patients')
    .insert({
      organization_id: orgId,
      full_name: fullName,
      phone:     phone || null,
      email:     intake.contact_email || null,
      status:    'lead',
    })
    .select('id')
    .single()

  if (patient?.id) {
    await sb.from('intakes').update({ patient_id: patient.id }).eq('id', leadId)
  }

  revalidatePath('/leads')
  revalidatePath(`/leads/${leadId}`)
}

export async function scheduleLeadAppointment(leadId: string): Promise<void> {
  const orgId = await getActiveClinicId()
  if (!orgId) return
  const sb = createAdminClient() as any

  const { data: intake } = await sb
    .from('intakes')
    .select('contact_name, contact_phone, contact_email, patient_id')
    .eq('id', leadId)
    .eq('organization_id', orgId)
    .single()
  if (!intake) return

  let patientId = intake.patient_id as string | null

  if (!patientId) {
    const phone    = intake.contact_phone ?? null
    const fullName = intake.contact_name?.trim()
      || (phone ? `Paciente ${String(phone).slice(-4)}` : 'Paciente sin nombre')

    const { data: patient } = await sb
      .from('patients')
      .insert({
        organization_id: orgId,
        full_name: fullName,
        phone:     phone || null,
        email:     intake.contact_email || null,
        status:    'lead',
      })
      .select('id')
      .single()

    if (patient?.id) {
      patientId = patient.id as string
      await sb.from('intakes').update({ patient_id: patientId }).eq('id', leadId)
    }
  }

  if (patientId) {
    redirect(`/appointments/new?patient_id=${patientId}&lead_id=${leadId}`)
  } else {
    redirect('/appointments/new')
  }
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

export async function markLeadInProgress(formData: FormData): Promise<void> {
  const id    = formData.get('id') as string
  const orgId = await getActiveClinicId()
  if (!orgId || !id) return

  const sb = createAdminClient() as any
  const now = new Date().toISOString()

  const { data: existing } = await sb
    .from('intakes')
    .select('first_response_at')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  await sb.from('intakes').update({
    status:             'in_progress',
    first_response_at:  existing?.first_response_at ?? now,
    updated_at:         now,
  }).eq('id', id).eq('organization_id', orgId)

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
}

export async function markLeadWaitingCustomer(formData: FormData): Promise<void> {
  const id    = formData.get('id') as string
  const orgId = await getActiveClinicId()
  if (!orgId || !id) return

  const sb = createAdminClient() as any
  await sb.from('intakes').update({
    status:     'waiting_customer',
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('organization_id', orgId)

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
}

export async function markLeadResolved(formData: FormData): Promise<void> {
  const id    = formData.get('id') as string
  const orgId = await getActiveClinicId()
  if (!orgId || !id) return

  const sb = createAdminClient() as any
  const now = new Date().toISOString()
  await sb.from('intakes').update({
    status:      'resolved',
    resolved_at: now,
    updated_at:  now,
  }).eq('id', id).eq('organization_id', orgId)

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
}

export async function addLeadNote(formData: FormData): Promise<void> {
  const id   = formData.get('id') as string
  const note = (formData.get('note') as string)?.trim()
  const orgId = await getActiveClinicId()
  if (!orgId || !id || !note) return

  const sb = createAdminClient() as any

  const { data: intake } = await sb
    .from('intakes')
    .select('id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!intake) return

  await sb.from('intake_events').insert({
    intake_id:       id,
    organization_id: orgId,
    event_type:      'note',
    actor:           'staff',
    details:         { note },
  })

  revalidatePath(`/leads/${id}`)
}
