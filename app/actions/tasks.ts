'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { runTaskAutomation } from '@/lib/customer-health/automation'

type TaskMeta = { clinic_id: string; status: string; priority: string } | null

async function getTask(taskId: string): Promise<TaskMeta> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('clinic_tasks')
    .select('clinic_id, status, priority')
    .eq('id', taskId)
    .single()
  return data
}

async function logAudit(entry: {
  task_id: string; clinic_id: string; action_type: string
  prev_status?: string; new_status?: string
  prev_priority?: string; new_priority?: string
  actor?: string; note?: string; metadata?: object
}): Promise<void> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('clinic_task_audit').insert({
    actor: 'admin',
    ...entry,
  })
}

// ── Resolve ──────────────────────────────────────────────────
export async function resolveTask(taskId: string): Promise<void> {
  const task = await getTask(taskId)
  if (!task) return

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('clinic_tasks')
      .update({ status: 'done', resolved_at: now })
      .eq('id', taskId),
    logAudit({
      task_id: taskId, clinic_id: task.clinic_id,
      action_type: 'resolved', prev_status: task.status, new_status: 'done',
    }),
  ])

  revalidatePath('/analytics/playbook')
}

// ── Snooze ───────────────────────────────────────────────────
export async function snoozeTask(taskId: string, days: number = 3): Promise<void> {
  const task = await getTask(taskId)
  if (!task) return

  const supabase = createAdminClient()
  const until = new Date()
  until.setDate(until.getDate() + days)

  await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('clinic_tasks')
      .update({ status: 'snoozed', snoozed_until: until.toISOString() })
      .eq('id', taskId),
    logAudit({
      task_id: taskId, clinic_id: task.clinic_id,
      action_type: 'snoozed', prev_status: task.status, new_status: 'snoozed',
      metadata: { days, snoozed_until: until.toISOString() },
    }),
  ])

  revalidatePath('/analytics/playbook')
}

// ── Add note ─────────────────────────────────────────────────
export async function addNote(taskId: string, formData: FormData): Promise<void> {
  const note = formData.get('note')?.toString().trim()
  if (!note) return

  const task = await getTask(taskId)
  if (!task) return

  const supabase = createAdminClient()

  await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('clinic_tasks')
      .update({ last_note: note })
      .eq('id', taskId),
    logAudit({
      task_id: taskId, clinic_id: task.clinic_id,
      action_type: 'note', note,
    }),
  ])

  revalidatePath('/analytics/playbook')
}

// ── Trigger automation manually ──────────────────────────────
export async function triggerAutomation(): Promise<void> {
  await runTaskAutomation()
  revalidatePath('/analytics/playbook')
}
