/**
 * Task automation rules — runs daily via cron, or on-demand from the playbook dashboard.
 *
 * Rules applied in order:
 *   1. Reopen snoozed tasks whose snoozed_until has passed
 *   2. Escalate medium-priority tasks open > 72h (only escalates once per task)
 *   3. Log a reminder entry for tasks open > 24h (email hook lives here)
 *   4. Sync new tasks from fresh health scores
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllClinicHealth } from './index'
import { syncClinicTasks } from './tasks'

const REMIND_AFTER_H  = 24   // hours before first reminder is logged
const ESCALATE_AFTER_H = 72  // hours before medium tasks are escalated to high

export interface AutomationResult {
  reopened:  number
  escalated: number
  reminded:  number
  synced:    number
  timestamp: string
}

export async function runTaskAutomation(): Promise<AutomationResult> {
  const supabase = createAdminClient()
  const now = new Date()
  const result: AutomationResult = { reopened: 0, escalated: 0, reminded: 0, synced: 0, timestamp: now.toISOString() }

  // ── 1. Reopen expired snoozes ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snoozed } = await (supabase as any)
    .from('clinic_tasks')
    .select('id, clinic_id, status')
    .eq('status', 'snoozed')
    .lte('snoozed_until', now.toISOString())

  for (const task of (snoozed ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('clinic_tasks')
      .update({ status: 'open', snoozed_until: null })
      .eq('id', task.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('clinic_task_audit').insert({
      task_id: task.id, clinic_id: task.clinic_id,
      action_type: 'reopened', prev_status: 'snoozed', new_status: 'open',
      actor: 'system', metadata: { reason: 'snooze_expired' },
    })
    result.reopened++
  }

  // ── 2. Escalate aging medium tasks ───────────────────────
  const escalateThreshold = new Date(now.getTime() - ESCALATE_AFTER_H * 3_600_000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toEscalate } = await (supabase as any)
    .from('clinic_tasks')
    .select('id, clinic_id')
    .eq('status', 'open')
    .eq('priority', 'medium')
    .is('escalated_at', null)
    .lte('created_at', escalateThreshold)

  for (const task of (toEscalate ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('clinic_tasks')
      .update({ priority: 'high', escalated_at: now.toISOString() })
      .eq('id', task.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('clinic_task_audit').insert({
      task_id: task.id, clinic_id: task.clinic_id,
      action_type: 'escalated', prev_priority: 'medium', new_priority: 'high',
      actor: 'system', metadata: { hours_open: ESCALATE_AFTER_H },
    })
    result.escalated++
  }

  // ── 3. Log reminders for stale tasks (one per task) ──────
  const remindThreshold = new Date(now.getTime() - REMIND_AFTER_H * 3_600_000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toRemind } = await (supabase as any)
    .from('clinic_tasks')
    .select('id, clinic_id, title, trigger_type, health_score')
    .eq('status', 'open')
    .is('reminder_sent_at', null)
    .lte('created_at', remindThreshold)

  for (const task of (toRemind ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('clinic_tasks')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', task.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('clinic_task_audit').insert({
      task_id: task.id, clinic_id: task.clinic_id,
      action_type: 'reminded', actor: 'system',
      metadata: { hours_open: REMIND_AFTER_H, trigger: task.trigger_type },
    })

    // EMAIL HOOK — uncomment and configure when ready:
    // await sendReminderEmail({
    //   to: process.env.OPS_EMAIL!,
    //   subject: `[PacienteIA] Tarea pendiente: ${task.title}`,
    //   body: `La tarea "${task.title}" lleva más de ${REMIND_AFTER_H}h abierta sin atención.`,
    // })

    result.reminded++
  }

  // ── 4. Sync new tasks from current health scores ─────────
  const health = await fetchAllClinicHealth()
  await syncClinicTasks(health)
  result.synced = health.length

  return result
}
