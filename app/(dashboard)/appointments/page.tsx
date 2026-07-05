import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { AppointmentCalendar } from '@/components/appointment/appointment-calendar'
import { GatedActionButton } from '@/components/plan/gated-action-button'
import type { Appointment, Patient } from '@/types/database'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/org-selector')

  const { year, month } = await searchParams
  const now = new Date()
  const y = Number(year ?? now.getFullYear())
  const m = Number(month ?? now.getMonth())  // 0-indexed

  const startDate = new Date(y, m, 1).toISOString()
  const endDate   = new Date(y, m + 1, 0, 23, 59, 59).toISOString()

  const supabase = await createClient()
  const { data } = await supabase
    .from('appointments')
    .select('*, patients(full_name)')
    .eq('organization_id', clinicId)
    .gte('scheduled_at', startDate)
    .lte('scheduled_at', endDate)
    .order('scheduled_at')

  type AptWithPatient = Appointment & { patients: Pick<Patient, 'full_name'> | null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Citas</h1>
        <GatedActionButton href="/appointments/new" resource="appointments">
          + Nueva cita
        </GatedActionButton>
      </div>
      <AppointmentCalendar
        appointments={(data ?? []) as unknown as AptWithPatient[]}
        year={y}
        month={m}
      />
    </div>
  )
}
