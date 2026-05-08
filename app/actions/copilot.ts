'use server'

import { revalidatePath } from 'next/cache'
import { createClient }   from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'
import { processInteraction } from '@/lib/copilot/process'

const adminSb = () => createAdminClient() as any

export async function submitInteraction(formData: FormData): Promise<void> {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const ctx = await getActiveContext()
  if (!ctx) return

  const rawContent  = (formData.get('raw_content') as string | null)?.trim()
  const patientId   = (formData.get('patient_id')  as string | null) || null

  if (!rawContent || rawContent.length < 5) return

  try {
    const result = await processInteraction(rawContent)

    if (result.tasks.length > 0) {
      await adminSb().from('copilot_tasks').insert(
        result.tasks.map((t: any) => ({
          organization_id: ctx.organizationId,
          branch_id:       ctx.branchId,
          patient_id:      patientId,
          title:           t.title,
          description:     t.description,
          priority:        t.priority,
        }))
      )
    }
  } catch {
    // silent — do not surface AI errors to UI
  }

  revalidatePath('/copilot')
}

export async function resolveTask(taskId: string): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) return

  await adminSb()
    .from('copilot_tasks')
    .update({ status: 'done', resolved_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('organization_id', ctx.organizationId)

  revalidatePath('/copilot')
}

export async function dismissTask(taskId: string): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) return

  await adminSb()
    .from('copilot_tasks')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('organization_id', ctx.organizationId)

  revalidatePath('/copilot')
}
