import { Badge } from '@/components/ui/badge'

type Priority = 'hot' | 'warm' | 'cold' | string | undefined

const PRIORITY_MAP: Record<string, { label: string; variant: 'red' | 'yellow' | 'gray' }> = {
  hot:  { label: 'Hot',  variant: 'red' },
  warm: { label: 'Warm', variant: 'yellow' },
  cold: { label: 'Cold', variant: 'gray' },
}

const INTENT_MAP: Record<string, { label: string; variant: 'blue' | 'green' | 'purple' | 'gray' }> = {
  cita:        { label: 'Cita',        variant: 'blue' },
  info:        { label: 'Info',        variant: 'gray' },
  seguimiento: { label: 'Seguimiento', variant: 'green' },
  spam:        { label: 'Spam',        variant: 'gray' },
}

const URGENCY_MAP: Record<string, { label: string; variant: 'red' | 'yellow' | 'gray' }> = {
  hoy:   { label: 'Hoy',    variant: 'red' },
  semana: { label: 'Semana', variant: 'yellow' },
  mes:   { label: 'Mes',    variant: 'gray' },
}

export function LeadPriorityBadge({ priority }: { priority?: Priority }) {
  const cfg = PRIORITY_MAP[priority ?? ''] ?? PRIORITY_MAP.cold
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export function LeadIntentBadge({ intent }: { intent?: string }) {
  const cfg = INTENT_MAP[intent ?? ''] ?? { label: intent ?? '—', variant: 'gray' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export function LeadUrgencyBadge({ urgency }: { urgency?: string }) {
  const cfg = URGENCY_MAP[urgency ?? ''] ?? { label: urgency ?? '—', variant: 'gray' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
