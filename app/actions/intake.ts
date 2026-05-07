'use server'

import { revalidatePath }    from 'next/cache'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { normalizeIntake }   from '@/lib/intake/normalize'
import { shouldCreateTask, defaultTask, overridePriority } from '@/lib/intake/route'
import { computeSlaDue, computeFollowUpDue } from '@/lib/intake/orchestrate'
import type { IntakeChannel } from '@/lib/intake/index'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminSb = () => createAdminClient() as any

// ── Audit log helper (never throws) ──────────────────────────
async function logEvent(
  intakeId: string,
  clinicId: string,
  eventType: string,
  actor = 'system',
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await adminSb().from('intake_events').insert({ intake_id: intakeId, clinic_id: clinicId, event_type: eventType, actor, details })
  } catch { /* never block on audit log */ }
}

// ── Internal: process and persist a raw intake ────────────────
export interface RawIntakeInput {
  clinicId:      string
  channel:       IntakeChannel
  externalId?:   string
  contactName?:  string
  contactPhone?: string
  contactEmail?: string
  rawContent:    string
  patientId?:    string
  metadata?:     Record<string, unknown>
}

export async function processIntake(input: RawIntakeInput): Promise<string | null> {
  const sb = adminSb()

  const { data: row, error: insertErr } = await sb
    .from('intakes')
    .insert({
      clinic_id:      input.clinicId,
      source_channel: input.channel,
      external_id:    input.externalId    ?? null,
      contact_name:   input.contactName   ?? null,
      contact_phone:  input.contactPhone  ?? null,
      contact_email:  input.contactEmail  ?? null,
      raw_content:    input.rawContent,
      patient_id:     input.patientId     ?? null,
      metadata:       input.metadata      ?? {},
      status:         'new',
    })
    .select('id')
    .single()

  if (insertErr || !row) return null

  const intakeId = row.id as string

  try {
    const result = await normalizeIntake(input.rawContent)
    const { priority, intent } = overridePriority(
      input.rawContent,
      result.priority,
      result.detectedIntent,
      input.channel,
    )

    const slaDueAt = computeSlaDue(priority).toISOString()

    const taskToCreate = shouldCreateTask(intent)
      ? (result.suggestedTask ?? defaultTask(intent, input.contactName ?? null, result.normalizedSummary))
      : result.suggestedTask

    let tasksCreated = 0
    if (taskToCreate) {
      await sb.from('copilot_tasks').insert({
        interaction_id: await createSyntheticInteraction(sb, input.clinicId, intakeId, result.normalizedSummary),
        clinic_id:      input.clinicId,
        patient_id:     input.patientId ?? null,
        title:          taskToCreate.title,
        description:    taskToCreate.description,
        priority:       taskToCreate.priority,
      })
      tasksCreated = 1
    }

    await sb.from('intakes').update({
      normalized_summary: result.normalizedSummary,
      detected_intent:    intent,
      priority,
      sla_due_at:         slaDueAt,
      tasks_created:      tasksCreated,
    }).eq('id', intakeId)

    await logEvent(intakeId, input.clinicId, 'normalized', 'system', {
      intent, priority, tasksCreated, slaDueAt,
    })
    if (tasksCreated > 0) {
      await logEvent(intakeId, input.clinicId, 'task_created', 'system', { taskTitle: taskToCreate?.title })
    }
  } catch {
    // Normalization failed — intake saved as raw, staff handles manually
  }

  await logEvent(intakeId, input.clinicId, 'created', 'system', { channel: input.channel })
  return intakeId
}

async function createSyntheticInteraction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  clinicId: string,
  intakeId: string,
  summary: string,
): Promise<string> {
  const { data } = await sb.from('interactions').insert({
    clinic_id:   clinicId,
    source_type: 'staff_note',
    raw_content: `[Intake ${intakeId}] ${summary}`,
    status:      'done',
  }).select('id').single()
  return data.id as string
}

// ── Server action: manual intake from form ────────────────────
export async function submitManualIntake(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  const rawContent = (formData.get('raw_content') as string | null)?.trim()
  if (!rawContent || rawContent.length < 3) return

  await processIntake({
    clinicId,
    channel:      formData.get('source_channel') as IntakeChannel,
    contactName:  (formData.get('contact_name')  as string | null) || undefined,
    contactPhone: (formData.get('contact_phone') as string | null) || undefined,
    contactEmail: (formData.get('contact_email') as string | null) || undefined,
    rawContent,
  })

  revalidatePath('/inbox')
}

// ── Status transitions ────────────────────────────────────────
export async function markInProgress(intakeId: string): Promise<void> {
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const clinicId   = await getActiveClinicId()
  if (!clinicId) return

  await adminSb()
    .from('intakes')
    .update({
      status:            'in_progress',
      first_response_at: new Date().toISOString(),
      assigned_to:       user?.id ?? null,
    })
    .eq('id', intakeId).eq('clinic_id', clinicId)

  await logEvent(intakeId, clinicId, 'status_changed', user?.id ?? 'system', { status: 'in_progress' })

  revalidatePath('/inbox')
  revalidatePath(`/inbox/${intakeId}`)
  revalidatePath('/ops')
}

export async function setWaitingCustomer(intakeId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  // Fetch current priority to compute follow-up deadline
  const sb = adminSb()
  const { data } = await sb.from('intakes').select('priority').eq('id', intakeId).single()
  const priority = (data?.priority ?? 'medium') as 'high' | 'medium' | 'low'

  const followUpDueAt = computeFollowUpDue(priority).toISOString()
  await sb.from('intakes').update({
    status:           'waiting_customer',
    follow_up_due_at: followUpDueAt,
  }).eq('id', intakeId).eq('clinic_id', clinicId)

  await logEvent(intakeId, clinicId, 'status_changed', 'system', { status: 'waiting_customer', followUpDueAt })

  revalidatePath('/inbox')
  revalidatePath(`/inbox/${intakeId}`)
  revalidatePath('/ops')
}

export async function setWaitingStaff(intakeId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  await adminSb().from('intakes').update({ status: 'waiting_staff' })
    .eq('id', intakeId).eq('clinic_id', clinicId)

  await logEvent(intakeId, clinicId, 'status_changed', 'system', { status: 'waiting_staff' })

  revalidatePath('/inbox')
  revalidatePath(`/inbox/${intakeId}`)
  revalidatePath('/ops')
}

export async function assignToMe(intakeId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  await adminSb().from('intakes').update({
    assigned_to: user.id,
    status:      'in_progress',
    first_response_at: new Date().toISOString(),
  }).eq('id', intakeId).eq('clinic_id', clinicId)

  await logEvent(intakeId, clinicId, 'assigned', user.id, { assignedTo: user.id })

  revalidatePath('/inbox')
  revalidatePath(`/inbox/${intakeId}`)
  revalidatePath('/ops')
}

export async function resolveIntake(intakeId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return
  await adminSb()
    .from('intakes')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', intakeId).eq('clinic_id', clinicId)
  await logEvent(intakeId, clinicId, 'resolved', 'system')
  revalidatePath('/inbox')
  revalidatePath(`/inbox/${intakeId}`)
  revalidatePath('/ops')
}

export async function dismissIntake(intakeId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return
  await adminSb()
    .from('intakes')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', intakeId).eq('clinic_id', clinicId)
  await logEvent(intakeId, clinicId, 'dismissed', 'system')
  revalidatePath('/inbox')
  revalidatePath(`/inbox/${intakeId}`)
}
