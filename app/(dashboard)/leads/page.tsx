import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { LeadTable, type IntakeRow } from '@/components/lead/lead-table'
import { GatedActionButton } from '@/components/plan/gated-action-button'
import { isFeatureAllowed } from '@/lib/plans/gating'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const { status = '' } = await searchParams
  const supabase = await createClient()

  const query = (supabase as any)
    .from('intakes')
    .select(
      'id, contact_name, contact_phone, source_channel, raw_content, normalized_summary, ' +
      'priority, status, detected_intent, sla_due_at, first_response_at, patient_id, created_at',
      { count: 'exact' }
    )
    .eq('organization_id', clinicId)
    .not('status', 'in', '("resolved","dismissed")')
    .order('created_at', { ascending: false })
    .limit(100)

  const [{ data, count }, canExport] = await Promise.all([
    query,
    isFeatureAllowed(clinicId, 'csv_export'),
  ])

  const allLeads = (data ?? []) as IntakeRow[]

  const leads = status
    ? allLeads.filter((l) => l.status === status)
    : allLeads

  const newCount      = allLeads.filter((l) => l.status === 'new').length
  const highCount     = allLeads.filter((l) => l.priority === 'high').length
  const overdueCount  = allLeads.filter(
    (l) => l.sla_due_at && new Date(l.sla_due_at) < new Date()
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Leads</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate flex-wrap">
            <span>{count ?? 0} activos</span>
            {newCount > 0     && <span className="text-blue-600 font-medium">{newCount} nuevos</span>}
            {highCount > 0    && <span className="text-red-600 font-medium">{highCount} alta prioridad</span>}
            {overdueCount > 0 && <span className="text-red-700 font-semibold">{overdueCount} ⚠ SLA vencido</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? (
            <a
              href="/api/export/leads"
              className="text-sm font-medium border border-fog hover:border-slate text-slate hover:text-ink px-3 py-2 rounded-lg transition-colors"
            >
              Exportar CSV
            </a>
          ) : (
            <span className="text-xs text-slate border border-dashed border-fog px-3 py-2 rounded-lg" title="Requiere plan Pro">
              Exportar CSV (Pro)
            </span>
          )}
          <GatedActionButton href="/leads/new" resource="leads">
            + Nuevo lead
          </GatedActionButton>
        </div>
      </div>

      <Suspense>
        <LeadTable leads={leads} />
      </Suspense>
    </div>
  )
}
