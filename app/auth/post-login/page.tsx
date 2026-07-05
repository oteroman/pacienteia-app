import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setActiveContext }  from '@/lib/tenant/context'
import { redirect }          from 'next/navigation'

// Landing page after OAuth / magic-link flows — mirrors the membership-routing
// logic in app/(auth)/login/actions.ts login()
export default async function PostLoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Platform admin check
  if (user.app_metadata?.platform_role) redirect('/platform')

  const sb = createAdminClient() as any
  const { data: profile } = await sb
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single()
  if (profile?.platform_role) redirect('/platform')

  // Membership routing
  const { data: memberships } = await supabase
    .from('org_members')
    .select('organization_id, role, organizations(id, name, slug, onboarding_status, branches(id, name))')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (!memberships || memberships.length === 0) redirect('/onboarding')

  if (memberships.length === 1) {
    const org    = (memberships[0] as any).organizations
    const branch = org?.branches?.[0]
    if (org?.onboarding_status && org.onboarding_status !== 'first_flow_active') redirect('/onboarding/resume')
    if (!branch) redirect('/org-selector')
    await setActiveContext(org.id, branch.id)
    redirect('/dashboard')
  }

  redirect('/org-selector')
}
