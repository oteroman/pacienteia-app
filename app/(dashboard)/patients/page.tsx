import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { PatientTable } from '@/components/patient/patient-table'
import { Pagination } from '@/components/ui/pagination'
import { LinkButton } from '@/components/ui/button'
import type { Patient, PatientStatus } from '@/types/database'

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}

export default async function PatientsPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const { q = '', status = '', page = '1' } = await searchParams
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{count ?? 0} pacientes en total</p>
        </div>
        <LinkButton href="/patients/new">+ Nuevo paciente</LinkButton>
      </div>

      <PatientTable patients={(patients ?? []) as Patient[]} />
      <Pagination page={currentPage} totalPages={totalPages} />
    </div>
  )
}
