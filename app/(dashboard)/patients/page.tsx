import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { PatientTable } from '@/components/patient/patient-table'
import { PatientCard } from '@/components/patient/card'
import { Pagination } from '@/components/ui/pagination'
import { LinkButton } from '@/components/ui/button'
import { ViewToggle } from '@/components/patient/view-toggle'
import type { Patient, PatientStatus } from '@/types/database'

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string; view?: string }>
}

export default async function PatientsPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const { q = '', status = '', page = '1', view = 'table' } = await searchParams
  const currentPage = Math.max(1, Number(page))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

  let query = supabase
    .from('patients')
    .select('*', { count: 'exact' })
    .eq('clinic_id', clinicId)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{count ?? 0} pacientes en total</p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense><ViewToggle current={view} /></Suspense>
          <LinkButton href="/patients/new">+ Nuevo paciente</LinkButton>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">👤</p>
              <p className="text-sm">No se encontraron pacientes</p>
            </div>
          ) : (
            list.map((p) => <PatientCard key={p.id} patient={p} />)
          )}
        </div>
      ) : (
        <PatientTable patients={list} />
      )}

      <Pagination page={currentPage} totalPages={totalPages} />
    </div>
  )
}
