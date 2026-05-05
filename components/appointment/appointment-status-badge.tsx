import { Badge } from '@/components/ui/badge'
import type { AppointmentStatus } from '@/types/database'

const config: Record<AppointmentStatus, { label: string; variant: 'gray' | 'green' | 'brand' | 'red' | 'yellow' }> = {
  scheduled:  { label: 'Programada',  variant: 'gray' },
  confirmed:  { label: 'Confirmada',  variant: 'green' },
  completed:  { label: 'Completada',  variant: 'brand' },
  cancelled:  { label: 'Cancelada',   variant: 'red' },
  no_show:    { label: 'No-show',     variant: 'yellow' },
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, variant } = config[status] ?? config.scheduled
  return <Badge variant={variant}>{label}</Badge>
}
