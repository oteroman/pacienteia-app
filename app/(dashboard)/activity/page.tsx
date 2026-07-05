import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { getActiveContext }  from '@/lib/tenant/context'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind = 'appointment' | 'ai_task' | 'reminder'

interface ActivityItem {
  id:          string
  kind:        EventKind
  created_at:  string
  title:       string
  subtitle:    string
  actor:       string
  link?:       string
}

// ── Event labels ──────────────────────────────────────────────────────────────

const APT_EVENT_LABELS: Record<string, string> = {
  created:          'Cita creada',
  status_changed:   'Estado actualizado',
  notes_updated:    'Notas editadas',
  rescheduled:      'Reagendada',
  payment_received: 'Pago recibido',
  cancelled:        'Cancelada',
}

const APT_EVENT_COLORS: Record<string, string> = {
  created:          'bg-green-50 text-green-700 border-green-200',
  cancelled:        'bg-red-50 text-red-700 border-red-200',
  rescheduled:      'bg-amber-50 text-amber-700 border-amber-200',
  payment_received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  status_changed:   'bg-brand-50 text-brand-700 border-brand-200',
  notes_updated:    'bg-mist text-slate border-fog',
}

const TASK_PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high:   'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-ai-50 text-ai-600 border-ai-200',
  low:    'bg-mist text-slate border-fog',
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchActivity(organizationId: string, branchId: string): Promise<ActivityItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [eventsRes, tasksRes, remindersRes] = await Promise.all([
    sb.from('appointment_events')
      .select('id, event_type, actor, details, created_at, appointment_id, appointments(treatment_type, scheduled_at, patients(full_name))')
      .eq('organization_id', organizationId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(80),
    sb.from('copilot_tasks')
      .select('id, title, priority, source, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    sb.from('appointment_reminders')
      .select('id, reminder_type, sent_at, appointments(treatment_type, scheduled_at, branch_id, patients(full_name))')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .gte('sent_at', since)
      .order('sent_at', { ascending: false })
      .limit(40),
  ])

  const items: ActivityItem[] = []

  // Appointment events
  for (const e of (eventsRes.data ?? [])) {
    const apt     = e.appointments
    const patient = apt?.patients?.full_name ?? 'Paciente desconocido'
    const tx      = apt?.treatment_type ?? 'cita'
    items.push({
      id:         e.id,
      kind:       'appointment',
      created_at: e.created_at,
      title:      `${APT_EVENT_LABELS[e.event_type] ?? e.event_type}: ${patient}`,
      subtitle:   tx,
      actor:      e.actor === 'system' ? 'Sistema' : e.actor,
      link:       e.appointment_id ? `/appointments/${e.appointment_id}` : undefined,
    })
  }

  // AI tasks
  for (const t of (tasksRes.data ?? [])) {
    items.push({
      id:         t.id,
      kind:       'ai_task',
      created_at: t.created_at,
      title:      t.title,
      subtitle:   `Prioridad ${t.priority} · fuente: ${t.source ?? 'IA'}`,
      actor:      '🤖 Copiloto IA',
      link:       `/copilot/tasks/${t.id}`,
    })
  }

  // Reminders sent
  for (const r of (remindersRes.data ?? [])) {
    const apt     = r.appointments
    const patient = apt?.patients?.full_name ?? 'Paciente'
    const type    = r.reminder_type === '24h' ? 'Recordatorio 24h' : r.reminder_type === '2h' ? 'Recordatorio 2h' : `Recordatorio ${r.reminder_type}`
    items.push({
      id:         r.id,
      kind:       'reminder',
      created_at: r.sent_at,
      title:      `${type} enviado a ${patient}`,
      subtitle:   apt?.treatment_type ?? 'cita',
      actor:      '🤖 Automático',
    })
  }

  // Sort all by date descending
  items.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return items
}

// ── Group by day ──────────────────────────────────────────────────────────────

function groupByDay(items: ActivityItem[]): { dayLabel: string; items: ActivityItem[] }[] {
  const groups: Record<string, ActivityItem[]> = {}
  for (const item of items) {
    const day = item.created_at.slice(0, 10)
    if (!groups[day]) groups[day] = []
    groups[day].push(item)
  }
  return Object.entries(groups).map(([day, items]) => {
    const d = new Date(day + 'T12:00:00Z')
    const today    = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const label = day === today ? 'Hoy' : day === yesterday ? 'Ayer'
      : d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    return { dayLabel: label, items }
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ActivityPage() {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) redirect('/org-selector')

  const items  = await fetchActivity(ctx.organizationId, ctx.branchId)
  const groups = groupByDay(items)

  return (
    <div className="space-y-6 max-w-3xl">

      <div>
        <h1 className="text-2xl font-bold text-ink">Bitácora</h1>
        <p className="text-sm text-slate mt-0.5">
          Registro de acciones del staff y del sistema de IA en los últimos 30 días.
        </p>
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border border-fog bg-white px-4 py-16 text-center text-sm text-slate">
          Sin actividad registrada todavía.
        </div>
      )}

      {groups.map(({ dayLabel, items: dayItems }) => (
        <div key={dayLabel}>
          {/* Day header */}
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs font-semibold text-slate uppercase tracking-wide">{dayLabel}</p>
            <div className="flex-1 h-px bg-fog" />
            <p className="text-xs text-slate">{dayItems.length} evento{dayItems.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {dayItems.map(item => {
              const eventType = item.kind === 'appointment'
                ? item.title.split(':')[0].trim().toLowerCase().replace(/ /g, '_')
                : null

              const badgeColor = item.kind === 'ai_task'
                ? (TASK_PRIORITY_COLORS[item.subtitle.split(' ')[1]] ?? 'bg-ai-50 text-ai-600 border-ai-200')
                : item.kind === 'reminder'
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : (APT_EVENT_COLORS[eventType ?? ''] ?? 'bg-mist text-slate border-fog')

              const badgeLabel = item.kind === 'ai_task' ? 'IA'
                : item.kind === 'reminder' ? 'Recordatorio'
                : (APT_EVENT_LABELS[eventType ?? ''] ?? eventType ?? 'cita')

              const time = new Date(item.created_at).toLocaleTimeString('es-PE', {
                hour: '2-digit', minute: '2-digit',
              })

              const content = (
                <div className="flex items-start gap-3 rounded-xl border border-fog bg-white px-4 py-3 hover:bg-mist/30 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                    <p className="text-xs text-slate truncate mt-0.5">{item.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate">{time}</p>
                    <p className="text-[10px] text-slate/70 mt-0.5 truncate max-w-[120px]">{item.actor}</p>
                  </div>
                </div>
              )

              return item.link ? (
                <Link key={item.id} href={item.link}>{content}</Link>
              ) : (
                <div key={item.id}>{content}</div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
