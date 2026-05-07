import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { redirect } from 'next/navigation'
import { getOnboardingProgress } from '@/lib/plans/onboarding'
import { OnboardingChecklist } from '@/components/plan/onboarding-checklist'
import type { MetricsDaily, Patient } from '@/types/database'

interface AppointmentRow {
  id: string
  treatment_type: string
  scheduled_at: string
  status: string
  patients: Pick<Patient, 'full_name'> | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const today = new Date().toISOString().split('T')[0]

  // Fetch onboarding progress + dashboard data in parallel
  const [onboarding, metricsRes, patientsRes, appointmentsRes] = await Promise.all([
    getOnboardingProgress(clinicId),
    supabase
      .from('metrics_daily')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'active'),
    supabase
      .from('appointments')
      .select('id, treatment_type, scheduled_at, status, patients(full_name)')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', `${today}T00:00:00`)
      .lte('scheduled_at', `${today}T23:59:59`)
      .order('scheduled_at'),
  ])

  const metrics = metricsRes.data as MetricsDaily | null
  const activePatients = patientsRes.count ?? 0
  const todayAppointments = (appointmentsRes.data ?? []) as unknown as AppointmentRow[]

  const cards = [
    {
      label: 'Pacientes activos',
      value: activePatients,
      color: 'text-brand-600',
    },
    {
      label: 'Citas hoy',
      value: todayAppointments.length,
      color: 'text-green-600',
    },
    {
      label: 'No-shows hoy',
      value: metrics?.appointments_no_show ?? 0,
      color: 'text-red-600',
    },
    {
      label: 'Ingresos recuperados',
      value: metrics
        ? `S/ ${Number(metrics.estimated_revenue_recovered).toFixed(0)}`
        : 'S/ 0',
      color: 'text-purple-600',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumen operacional</h1>
        <p className="text-sm text-gray-500 mt-1">{formatDate(today)}</p>
      </div>

      {/* Onboarding checklist — auto-hides when all steps done or skipped */}
      <OnboardingChecklist progress={onboarding} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Today's appointments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Citas de hoy</h2>
        </div>
        {todayAppointments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            No hay citas programadas para hoy
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {todayAppointments.map((apt) => (
              <li key={apt.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {apt.patients?.full_name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{apt.treatment_type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {new Date(apt.scheduled_at).toLocaleTimeString('es-PE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <StatusBadge status={apt.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Programada', className: 'bg-gray-100 text-gray-600' },
    confirmed: { label: 'Confirmada',  className: 'bg-green-100 text-green-700' },
    completed: { label: 'Completada', className: 'bg-brand-100 text-brand-700' },
    cancelled: { label: 'Cancelada',  className: 'bg-red-100 text-red-600' },
    no_show:   { label: 'No-show',    className: 'bg-yellow-100 text-yellow-700' },
  }
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${className}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
