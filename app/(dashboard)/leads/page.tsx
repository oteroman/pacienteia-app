import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { LeadTable } from '@/components/lead/lead-table'
import { GatedActionButton } from '@/components/plan/gated-action-button'
import type { LeadEvent } from '@/types/database'

type LeadPayload = { ai_priority?: string }

interface PageProps {
  searchParams: Promise<{ priority?: string }>
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const { priority = '' } = await searchParams
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('lead_events')
    .select('*', { count: 'exact' })
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const allLeads = (data ?? []) as LeadEvent[]

  const leads = priority
    ? allLeads.filter((l) => {
        const p = (l.payload ?? {}) as LeadPayload
        return p.ai_priority === priority
      })
    : allLeads

  const hotCount  = allLeads.filter((l) => ((l.payload ?? {}) as LeadPayload).ai_priority === 'hot').length
  const warmCount = allLeads.filter((l) => ((l.payload ?? {}) as LeadPayload).ai_priority === 'warm').length
  const coldCount = allLeads.filter((l) => ((l.payload ?? {}) as LeadPayload).ai_priority === 'cold').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>{count ?? 0} total</span>
            {hotCount > 0  && <span className="text-red-600 font-medium">{hotCount} hot</span>}
            {warmCount > 0 && <span className="text-yellow-600 font-medium">{warmCount} warm</span>}
            {coldCount > 0 && <span className="text-gray-400">{coldCount} cold</span>}
          </div>
        </div>
        <GatedActionButton href="/leads/new" resource="leads">
          + Nuevo lead
        </GatedActionButton>
      </div>

      <Suspense>
        <LeadTable leads={leads} />
      </Suspense>
    </div>
  )
}
