// ── Automation rules map ──────────────────────────────────────
// Single source of truth for what gets automated, how, and by whom.
// Engine: 'rules' = pure TS logic, 'llm' = Haiku API call, 'rules+llm' = both
// Trigger: 'event' = runs inline when intake is processed, 'cron' = scheduled job

export interface AutomationRule {
  id:            string
  trigger:       string
  condition:     string
  action:        string
  engine:        'rules' | 'llm' | 'rules+llm'
  when:          'event' | 'cron'
  cronSchedule?: string
  implemented:   boolean
}

export const AUTOMATION_RULES: AutomationRule[] = [
  // ── On intake arrival (event) ─────────────────────────────
  {
    id:          'normalize',
    trigger:     'Nuevo intake recibido',
    condition:   'Siempre',
    action:      'LLM extrae: resumen, intent, prioridad sugerida',
    engine:      'llm',
    when:        'event',
    implemented: true,
  },
  {
    id:          'keyword_override',
    trigger:     'Nuevo intake recibido',
    condition:   'Contiene keywords urgentes (dolor, emergencia, reacción…)',
    action:      'Escalar prioridad → high, intent → urgent (sin IA)',
    engine:      'rules',
    when:        'event',
    implemented: true,
  },
  {
    id:          'sla_assignment',
    trigger:     'Intent + prioridad definidos',
    condition:   'Siempre',
    action:      'Calcular sla_due_at según prioridad (high=1h, medium=4h, low=24h)',
    engine:      'rules',
    when:        'event',
    implemented: true,
  },
  {
    id:          'auto_task_lead',
    trigger:     'Intent = lead_inquiry',
    condition:   'Siempre',
    action:      'Crear tarea en Copiloto: "Responder consulta de [nombre]"',
    engine:      'rules',
    when:        'event',
    implemented: true,
  },
  {
    id:          'auto_task_appointment',
    trigger:     'Intent = appointment_request',
    condition:   'Siempre',
    action:      'Crear tarea en Copiloto: "Agendar cita — [nombre]" (prioridad high)',
    engine:      'rules',
    when:        'event',
    implemented: true,
  },
  {
    id:          'auto_task_urgent',
    trigger:     'Intent = urgent',
    condition:   'Siempre',
    action:      'Crear tarea en Copiloto: "URGENTE: atender a [nombre]" (prioridad high)',
    engine:      'rules',
    when:        'event',
    implemented: true,
  },
  {
    id:          'tiktok_intent',
    trigger:     'Canal = tiktok',
    condition:   'Siempre',
    action:      'Forzar intent → lead_inquiry independientemente del LLM',
    engine:      'rules',
    when:        'event',
    implemented: true,
  },

  // ── Time-based (cron: every hour) ─────────────────────────
  {
    id:          'sla_escalate',
    trigger:     'SLA vencido (sla_due_at < NOW())',
    condition:   'status activo AND escalation_level = 0',
    action:      'Escalar nivel 1, prioridad → high, crear tarea en Copiloto',
    engine:      'rules',
    when:        'cron',
    cronSchedule: '0 * * * *',
    implemented: true,
  },
  {
    id:          'followup_trigger',
    trigger:     'follow_up_due_at vencido',
    condition:   'status = waiting_customer',
    action:      'Mover a waiting_staff para que el staff vea que necesita seguimiento',
    engine:      'rules',
    when:        'cron',
    cronSchedule: '0 * * * *',
    implemented: true,
  },

  // ── Time-based (cron: daily 9am) ──────────────────────────
  {
    id:          'playbook_tasks',
    trigger:     'Health score < umbral por clínica',
    condition:   'upgrade_ready OR renewal_risk_severe',
    action:      'Crear tareas de playbook CS si no existen aún',
    engine:      'rules',
    when:        'cron',
    cronSchedule: '0 9 * * *',
    implemented: true,
  },

  // ── Asistencia en UI (on-demand, no automático) ───────────
  {
    id:          'draft_suggestion',
    trigger:     'Staff abre detalle de intake',
    condition:   'Intent detectado',
    action:      'Mostrar plantillas + botón "Borrador IA" (no se envía automáticamente)',
    engine:      'rules+llm',
    when:        'event',
    implemented: true,
  },
]

export const RULES_BY_TRIGGER = Object.groupBy(AUTOMATION_RULES, (r) => r.when)
