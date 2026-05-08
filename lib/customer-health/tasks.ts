import { createAdminClient } from '@/lib/supabase/admin'
import type { AlertType, ClinicHealth } from './index'

// ── Playbook definitions ─────────────────────────────────────
export interface Playbook {
  title:           string
  description:     string
  action:          string
  priority:        'high' | 'medium' | 'low'
  sla:             string
  messageTemplate: string
}

export const PLAYBOOKS: Record<AlertType, Playbook> = {
  at_risk: {
    title:       'Clínica en riesgo',
    description: 'Actividad significativamente baja en los últimos 14 días.',
    action:      'Contactar al dueño en 48h. Preguntar por bloqueos o insatisfacción.',
    priority:    'high',
    sla:         '48h',
    messageTemplate:
      'Hola [nombre], notamos que no han estado usando mucho Paciente IA últimamente. ¿Hay algo en lo que te podamos ayudar? Queremos asegurarnos de que estás sacando el máximo provecho.',
  },
  churned: {
    title:       'Clínica inactiva',
    description: 'Sin actividad registrada en más de 30 días.',
    action:      'Llamada de reactivación o gestión ordenada de cancelación.',
    priority:    'high',
    sla:         '24h',
    messageTemplate:
      'Hola [nombre], hace tiempo que no vemos actividad en tu clínica. ¿Necesitas ayuda para retomar? Podemos agendar una sesión de soporte sin costo.',
  },
  upgrade_ready: {
    title:       'Lista para upgrade',
    description: 'Score alto y uso superior al 75% del plan actual.',
    action:      'Enviar propuesta de plan superior con beneficios. Hacer seguimiento en 24h.',
    priority:    'medium',
    sla:         '24h',
    messageTemplate:
      'Hola [nombre], están usando Paciente IA al máximo — eso es fantástico. Con el plan Pro obtendrías el doble de leads y citas. ¿Agendamos 15 minutos para mostrarte los números?',
  },
  high_friction: {
    title:       'Alta fricción sin conversión',
    description: 'Tres o más bloqueos duros en 7 días sin intento de upgrade.',
    action:      'Contactar para entender la barrera. Evaluar trial extendido o descuento.',
    priority:    'high',
    sla:         '48h',
    messageTemplate:
      'Hola [nombre], vemos que estás alcanzando los límites del plan con frecuencia. Queremos ayudarte a resolverlo. ¿Tienes 10 min para hablar esta semana?',
  },
  declining: {
    title:       'Caída de actividad',
    description: 'Actividad esta semana menor al 50% de la semana anterior.',
    action:      'Revisar si hay problema técnico o de satisfacción. Check-in proactivo.',
    priority:    'medium',
    sla:         '72h',
    messageTemplate:
      'Hola [nombre], notamos una baja en la actividad esta semana. ¿Todo bien? ¿Podemos ayudarte con algo?',
  },
  inactive: {
    title:       'Sin actividad reciente',
    description: 'Sin actividad registrada en 21 o más días.',
    action:      'Email de check-in. Identificar si hay dificultades o pérdida de interés.',
    priority:    'medium',
    sla:         '72h',
    messageTemplate:
      'Hola [nombre], hace unos días que no vemos actividad en tu cuenta. ¿Hay algo que podamos mejorar o en lo que podamos ayudarte?',
  },
}

// ── Types ────────────────────────────────────────────────────
export type TaskStatus = 'open' | 'done' | 'snoozed'

export interface ClinicTask {
  id:               string
  clinicId:         string
  clinicName:       string
  plan:             string
  triggerType:      AlertType
  status:           TaskStatus
  priority:         'high' | 'medium' | 'low'
  title:            string
  description:      string
  actionText:       string
  messageTemplate:  string | null
  healthScore:      number | null
  snoozedUntil:     string | null
  resolvedAt:       string | null
  escalatedAt:      string | null   // set by cron when auto-escalated
  reminderSentAt:   string | null   // set by cron when first reminder logged
  lastNote:         string | null   // denormalized last note for display
  createdAt:        string
}

export interface TaskAuditEntry {
  id:           string
  actionType:   string
  prevStatus:   string | null
  newStatus:    string | null
  prevPriority: string | null
  newPriority:  string | null
  actor:        string
  note:         string | null
  createdAt:    string
}

type TaskRow = {
  id: string; organization_id: string; trigger_type: string; status: string; priority: string
  title: string; description: string; action_text: string; message_template: string | null
  health_score: number | null; snoozed_until: string | null; resolved_at: string | null
  escalated_at: string | null; reminder_sent_at: string | null; last_note: string | null
  created_at: string
  organizations: { name: string; plan: string } | null
}

// ── Sync ─────────────────────────────────────────────────────
/**
 * Idempotent: checks existing open tasks before inserting.
 * Called on playbook page load — no cron needed for MVP.
 */
export async function syncClinicTasks(clinics: ClinicHealth[]): Promise<void> {
  const supabase = createAdminClient()

  // Fetch existing open tasks to avoid duplicates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRaw } = await (supabase as any)
    .from('clinic_tasks')
    .select('organization_id, trigger_type')
    .eq('status', 'open')

  const existing = new Set<string>(
    ((existingRaw ?? []) as { organization_id: string; trigger_type: string }[])
      .map((r) => `${r.organization_id}:${r.trigger_type}`)
  )

  const toInsert: object[] = []
  for (const clinic of clinics) {
    for (const alert of clinic.alerts) {
      if (existing.has(`${clinic.clinicId}:${alert}`)) continue
      const playbook = PLAYBOOKS[alert]
      if (!playbook) continue
      toInsert.push({
        organization_id:  clinic.clinicId,
        trigger_type:     alert,
        status:           'open',
        priority:         playbook.priority,
        title:            playbook.title,
        description:      playbook.description,
        action_text:      playbook.action,
        message_template: playbook.messageTemplate,
        health_score:     clinic.score.total,
      })
    }
  }

  if (toInsert.length === 0) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('clinic_tasks').insert(toInsert)
}

// ── Fetch ─────────────────────────────────────────────────────
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export async function fetchOpenTasks(): Promise<ClinicTask[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('clinic_tasks')
    .select('*, organizations(name, plan)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100)

  return ((data ?? []) as TaskRow[])
    .map(mapRow)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

export async function fetchRecentlyResolved(limit = 10): Promise<ClinicTask[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('clinic_tasks')
    .select('*, organizations(name, plan)')
    .in('status', ['done', 'snoozed'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as TaskRow[]).map(mapRow)
}

function mapRow(r: TaskRow): ClinicTask {
  return {
    id:              r.id,
    clinicId:        r.organization_id,
    clinicName:      r.organizations?.name ?? r.organization_id.slice(0, 8),
    plan:            r.organizations?.plan ?? 'unknown',
    triggerType:     r.trigger_type as AlertType,
    status:          r.status as TaskStatus,
    priority:        r.priority as 'high' | 'medium' | 'low',
    title:           r.title,
    description:     r.description,
    actionText:      r.action_text,
    messageTemplate: r.message_template,
    healthScore:     r.health_score,
    snoozedUntil:    r.snoozed_until,
    resolvedAt:      r.resolved_at,
    escalatedAt:     r.escalated_at,
    reminderSentAt:  r.reminder_sent_at,
    lastNote:        r.last_note,
    createdAt:       r.created_at,
  }
}

export async function fetchTaskAudit(taskId: string): Promise<TaskAuditEntry[]> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('clinic_task_audit')
    .select('id, action_type, prev_status, new_status, prev_priority, new_priority, actor, note, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(20)

  return ((data ?? []) as {
    id: string; action_type: string; prev_status: string | null; new_status: string | null
    prev_priority: string | null; new_priority: string | null; actor: string
    note: string | null; created_at: string
  }[]).map((r) => ({
    id:           r.id,
    actionType:   r.action_type,
    prevStatus:   r.prev_status,
    newStatus:    r.new_status,
    prevPriority: r.prev_priority,
    newPriority:  r.new_priority,
    actor:        r.actor,
    note:         r.note,
    createdAt:    r.created_at,
  }))
}
