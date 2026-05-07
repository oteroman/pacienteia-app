import { createClient } from '@/lib/supabase/server'
import type { Clinic } from '@/types/database'

export interface OnboardingStep {
  id: string
  label: string
  description: string
  done: boolean
  href: string
}

export interface OnboardingProgress {
  steps: OnboardingStep[]
  completed: number
  total: number
  allDone: boolean
}

export async function getOnboardingProgress(clinicId: string): Promise<OnboardingProgress> {
  const supabase = await createClient()

  const [clinicRes, patientsRes, reactivationRes, feedbackRes] = await Promise.all([
    supabase.from('clinics').select('*').eq('id', clinicId).single(),
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .neq('status', 'lead')
      .is('deleted_at', null),
    supabase
      .from('reactivation_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId),
    supabase
      .from('patient_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId),
  ])

  const clinic = clinicRes.data as Clinic | null
  const profileComplete = Boolean(clinic?.phone && clinic?.address)
  const hasPatient = (patientsRes.count ?? 0) > 0
  const hasAutomation = (reactivationRes.count ?? 0) > 0 || (feedbackRes.count ?? 0) > 0

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      label: 'Completa el perfil de tu clínica',
      description: 'Agrega dirección y teléfono para que tus pacientes te encuentren.',
      done: profileComplete,
      href: '/settings',
    },
    {
      id: 'patient',
      label: 'Registra tu primer paciente',
      description: 'Crea el historial del primer paciente en tu clínica.',
      done: hasPatient,
      href: '/patients/new',
    },
    {
      id: 'automation',
      label: 'Activa tu primera automatización',
      description: 'Conecta n8n y activa el Escudo de Reputación o Reactivación Pro.',
      done: hasAutomation,
      href: '/billing',
    },
  ]

  const completed = steps.filter((s) => s.done).length

  return {
    steps,
    completed,
    total: steps.length,
    allDone: completed === steps.length,
  }
}
