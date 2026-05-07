'use server'

import { revalidatePath } from 'next/cache'
import { createClient }   from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { processInteraction } from '@/lib/copilot/process'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminSb = () => createAdminClient() as any

export async function submitInteraction(formData: FormData): Promise<void> {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const clinicId    = await getActiveClinicId()
  if (!clinicId) return

  const sourceType  = formData.get('source_type') as string
  const rawContent  = (formData.get('raw_content') as string | null)?.trim()
  const patientId   = (formData.get('patient_id')  as string | null) || null

  if (!rawContent || rawContent.length < 5) return

  // Insert interaction as pending
  const sb = adminSb()
  const { data: interaction, error: intErr } = await sb
    .from('interactions')
    .insert({
      clinic_id:    clinicId,
      source_type:  sourceType,
      raw_content:  rawContent,
      patient_id:   patientId,
      submitted_by: user.id,
      status:       'processing',
    })
    .select('id')
    .single()

  if (intErr || !interaction) return

  const interactionId = interaction.id as string

  try {
    const result = await processInteraction(rawContent)

    // Insert summary
    await sb.from('interaction_summaries').insert({
      interaction_id: interactionId,
      clinic_id:      clinicId,
      summary:        result.summary,
      commitments:    result.commitments,
      risks:          result.risks,
      tasks_created:  result.tasks.length,
      model_used:     'claude-haiku-4-5-20251001',
    })

    // Insert tasks
    if (result.tasks.length > 0) {
      await sb.from('copilot_tasks').insert(
        result.tasks.map((t) => ({
          interaction_id: interactionId,
          clinic_id:      clinicId,
          patient_id:     patientId,
          title:          t.title,
          description:    t.description,
          priority:       t.priority,
        }))
      )
    }

    // Mark done
    await sb.from('interactions').update({ status: 'done' }).eq('id', interactionId)
  } catch {
    await sb.from('interactions').update({ status: 'failed' }).eq('id', interactionId)
  }

  revalidatePath('/copilot')
}

export async function resolveTask(taskId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  await adminSb()
    .from('copilot_tasks')
    .update({ status: 'done', resolved_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('clinic_id', clinicId)

  revalidatePath('/copilot')
}

export async function dismissTask(taskId: string): Promise<void> {
  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  await adminSb()
    .from('copilot_tasks')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('clinic_id', clinicId)

  revalidatePath('/copilot')
}
