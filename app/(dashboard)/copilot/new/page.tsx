import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import Link from 'next/link'
import NewInteractionForm from './NewInteractionForm'

export default async function NewInteractionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbClient = await createClient() as any
  const { data: patientsRaw } = await sbClient
    .from('patients')
    .select('id, full_name')
    .eq('organization_id', clinicId)
    .order('full_name')
    .limit(200)
  const patients = (patientsRaw ?? []) as { id: string; full_name: string }[]

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div className="flex items-center gap-3">
        <Link href="/copilot" className="text-sm text-gray-400 hover:text-gray-600">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva interacción</h1>
      </div>

      <NewInteractionForm patients={patients} />

    </div>
  )
}
