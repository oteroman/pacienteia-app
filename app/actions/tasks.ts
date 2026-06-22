'use server'

import { revalidatePath }     from 'next/cache'
import { createAdminClient }  from '@/lib/supabase/admin'
import { getActiveOrganizationId } from '@/lib/tenant/context'
import { runTaskAutomation }  from '@/lib/customer-health/automation'

export async function resolveTask(taskId: string): Promise<void> {
  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const sb = createAdminClient() as any
  await sb
    .from('copilot_tasks')
    .update({ status: 'done', resolved_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('organization_id', organizationId)

  revalidatePath('/analytics/playbook')
}

export async function snoozeTask(taskId: string, days: number = 3): Promise<void> {
  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const sb    = createAdminClient() as any
  const until = new Date()
  until.setDate(until.getDate() + days)

  await sb
    .from('copilot_tasks')
    .update({ status: 'dismissed', resolved_at: until.toISOString() })
    .eq('id', taskId)
    .eq('organization_id', organizationId)

  revalidatePath('/analytics/playbook')
}

export async function addNote(_taskId: string, _formData: FormData): Promise<void> {
  // Note storage not available in copilot_tasks schema — no-op for now
  revalidatePath('/analytics/playbook')
}

export async function triggerAutomation(): Promise<void> {
  await runTaskAutomation()
  revalidatePath('/analytics/playbook')
}
