import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { PatientTable } from '@/components/patient/patient-table'
import { PatientCard } from '@/components/patient/card'
import { Pagination } from '@/components/ui/pagination'
import { GatedActionButton } from '@/components/plan/gated-action-button'
import { ViewToggle } from '@/components/patient/view-toggle'
import { buildRetentionStats, calculateRetentionScore } from '@/lib/analytics/retention'
import { isFeatureAllowed } from '@/lib/plans/gating'
import type { RetentionScore } from '@/lib/analytics/retention'
import type { Patient, PatientStatus } from '@/types/database'

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string; view?: string }>
}

export default async function PatientsPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const { q = '', status = '', page = '1', view = 'table' } = await searchParams
  const currentPage = Math.max(1, Number(page))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

  let query = supabase
    .from('patients')
    .select('*', { count: 'exact' })
    .eq('organization_id', clinicId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,dni.ilike.%${q}%`)
  }
  if (status && ['active', 'inactive', 'lead', 'blocked'].includes(status)) {
    query = query.eq('status', status as PatientStatus)
  }

  const { data: patients, count } = await query
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)
  const list = (patients ?? []) as Patient[]
  const canExport = await isFeatureAllowed(clinicId, 'csv_export')

  // Compute retention scores for this page's patients
  let scores: Record<string, RetentionScore> | undefined
  if (list.length > 0) {
    const { data: rawApts } = await (supabase as any)
      .from('appointments')
      .select('patient_id, status, scheduled_at')
      .in('patient_id', list.map(p => p.id))
      .eq('organization_id', clinicId)

    const aptByPatient = new Map<string, { status: string; scheduled_at: string }[]>()
    for (const a of (rawApts ?? [])) {
      if (!aptByPatient.has(a.patient_id)) aptByPatient.set(a.patient_id, [])
      aptByPatient.get(a.patient_id)!.push(a)
    }

    scores = {}
    for (const p of list) {
      scores[p.id] = calculateRetentionScore(buildRetentionStats(aptByPatient.get(p.id) ?? []))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Pacientes</h1>
          <p className="text-sm text-slate mt-0.5">{count ?? 0} pacientes en total</p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense><ViewToggle current={view} /></Suspense>
          {canExport ? (
            <a
              href="/api/export/patients"
              className="text-sm font-medium border border-fog hover:border-slate text-slate hover:text-ink px-3 py-2 rounded-lg transition-colors"
            >
              Exportar CSV
            </a>
          ) : (
            <span className="text-xs text-slate border border-dashed border-fog px-3 py-2 rounded-lg" title="Requiere plan Pro">
              Exportar CSV (Pro)
            </span>
          )}
          <GatedActionButton href="/patients/new" resource="leads">
            + Nuevo paciente
          </GatedActionButton>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate">
              <p className="text-4xl mb-2">👤</p>
              <p className="text-sm">No se encontraron pacientes</p>
            </div>
          ) : (
            list.map((p) => <PatientCard key={p.id} patient={p} />)
          )}
        </div>
      ) : (
        <PatientTable patients={list} scores={scores} />
      )}

      <Pagination page={currentPage} totalPages={totalPages} />
    </div>
  )
}
