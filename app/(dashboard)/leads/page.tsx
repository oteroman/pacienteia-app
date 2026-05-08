import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { LeadTable } from '@/components/lead/lead-table'
import { GatedActionButton } from '@/components/plan/gated-action-button'
type LeadPayload = { ai_priority?: string }

interface PageProps {
  searchParams: Promise<{ priority?: string }>
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const { priority = '' } = await searchParams
  const supabase = await createClient()

  const { data, count } = await (supabase as any)
    .from('intakes')
    .select('*', { count: 'exact' })
    .eq('organization_id', clinicId)
    .in('detected_intent', ['lead_inquiry', 'appointment_request'])
    .not('status', 'in', '("resolved","dismissed")')
    .order('created_at', { ascending: false })
    .limit(100)

  const allLeads = (data ?? []) as any[]

  const leads = priority
    ? allLeads.filter((l) => l.priority === priority)
    : allLeads

  const hotCount  = allLeads.filter((l) => l.priority === 'high').length
  const warmCount = allLeads.filter((l) => l.priority === 'medium').length
  const coldCount = allLeads.filter((l) => l.priority === 'low').length

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
