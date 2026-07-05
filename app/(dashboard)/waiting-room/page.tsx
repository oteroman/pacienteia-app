import { redirect }          from 'next/navigation'
import { getActiveContext }  from '@/lib/tenant/context'
import { createAdminClient } from '@/lib/supabase/admin'
import WaitingRoomClient     from './WaitingRoomClient'

export const dynamic = 'force-dynamic'

export interface QueueEntry {
  id:             string
  patient_name:   string
  phone:          string
  treatment_type: string | null
  position:       number
  status:         'waiting' | 'called'
  entered_at:     string
  called_at:      string | null
}

async function fetchQueue(orgId: string, branchId: string): Promise<QueueEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('waiting_queue')
    .select('id, patient_name, phone, treatment_type, position, status, entered_at, called_at')
    .eq('organization_id', orgId)
    .eq('branch_id', branchId)
    .in('status', ['waiting', 'called'])
    .order('entered_at')
  return data ?? []
}

export default async function WaitingRoomPage() {
  const ctx = await getActiveContext()
  if (!ctx?.organizationId || !ctx?.branchId) redirect('/org-selector')

  const queue = await fetchQueue(ctx.organizationId, ctx.branchId)
  return <WaitingRoomClient queue={queue} />
}
