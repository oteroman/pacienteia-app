import { Badge } from '@/components/ui/badge'
import type { PatientStatus } from '@/types/database'

const config: Record<PatientStatus, { label: string; variant: 'green' | 'gray' | 'blue' | 'red' }> = {
  active:   { label: 'Activo',    variant: 'green' },
  inactive: { label: 'Inactivo',  variant: 'gray' },
  lead:     { label: 'Lead',      variant: 'blue' },
  blocked:  { label: 'Bloqueado', variant: 'red' },
}

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  const { label, variant } = config[status] ?? config.active
  return <Badge variant={variant}>{label}</Badge>
}
