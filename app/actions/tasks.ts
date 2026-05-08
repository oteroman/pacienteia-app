'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { runTaskAutomation } from '@/lib/customer-health/automation'

type TaskMeta = { organization_id: string; status: string; priority: string } | null

async function getTask(taskId: string): Promise<TaskMeta> {
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('copilot_tasks')
    .select('organization_id, status, priority')
    .eq('id', taskId)
    .single()
  return data
}

export async function resolveTask(taskId: string): Promise<void> {
  const task = await getTask(taskId)
  if (!task) return

  const sb = createAdminClient() as any
  await sb
    .from('copilot_tasks')
    .update({ status: 'done', resolved_at: new Date().toISOString() })
    .eq('id', taskId)

  revalidatePath('/analytics/playbook')
}

export async function snoozeTask(taskId: string, days: number = 3): Promise<void> {
  const task = await getTask(taskId)
  if (!task) return

  const sb = createAdminClient() as any
  const until = new Date()
  until.setDate(until.getDate() + days)

  await sb
    .from('copilot_tasks')
    .update({ status: 'dismissed', resolved_at: until.toISOString() })
    .eq('id', taskId)

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
