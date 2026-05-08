import { redirect }         from 'next/navigation'
import { createClient }     from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setActiveContext }  from '@/lib/tenant/context'

const STATUS_TO_STEP: Record<string, string> = {
  email_verified:     '/onboarding?step=1',
  org_created:        '/onboarding?step=2',
  branch_created:     '/onboarding?step=3',
  whatsapp_connected: '/onboarding?step=4',
  first_flow_active:  '/dashboard',
}

export default async function OnboardingResumePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient() as any

  const { data: org } = await sb
    .from('organizations')
    .select(`
      id, onboarding_status,
      branches (id)
    `)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!org) redirect('/onboarding?step=1')

  // If there's a branch, restore context cookie so dashboard works
  const branches = org.branches ?? []
  if (branches.length > 0) {
    await setActiveContext(org.id, branches[0].id)
  }

  const destination = STATUS_TO_STEP[org.onboarding_status] ?? '/onboarding?step=1'
  redirect(destination)
}
