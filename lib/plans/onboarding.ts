import { createClient } from '@/lib/supabase/server'

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

export async function getOnboardingProgress(organizationId: string): Promise<OnboardingProgress> {
  const supabase = await createClient()

  const [profileRes, patientsRes, whatsappRes] = await Promise.all([
    supabase
      .from('organization_profiles')
      .select('organization_id')
      .eq('organization_id', organizationId)
      .single(),
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null),
    supabase
      .from('branch_whatsapp_config')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active'),
  ])

  const hasProfile  = !!profileRes.data
  const hasPatient  = (patientsRes.count ?? 0) > 0
  const hasWhatsapp = (whatsappRes.count ?? 0) > 0

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      label: 'Completa el perfil de tu organización',
      description: 'Agrega logo, descripción y datos de contacto.',
      done: hasProfile,
      href: '/settings/clinic',
    },
    {
      id: 'patient',
      label: 'Registra tu primer paciente',
      description: 'Crea el historial del primer paciente en tu clínica.',
      done: hasPatient,
      href: '/patients/new',
    },
    {
      id: 'whatsapp',
      label: 'Conecta WhatsApp',
      description: 'Vincula el número de WhatsApp Business de tu sucursal.',
      done: hasWhatsapp,
      href: '/settings/whatsapp',
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
