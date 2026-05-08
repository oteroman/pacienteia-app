'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setActiveContext } from '@/lib/tenant/context'
import { redirect } from 'next/navigation'

interface LoginState {
  error: string | null
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email y contraseña son requeridos' }

  const supabase = await createClient()
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }

  const { data: { user } } = await supabase.auth.getUser()

  // Platform admins: check JWT app_metadata first (no DB call), then profiles fallback
  if (user?.app_metadata?.platform_role) redirect('/platform')

  const sb = createAdminClient() as any
  const { data: profile } = await sb
    .from('profiles').select('platform_role').eq('id', user!.id).single()
  if (profile?.platform_role) redirect('/platform')

  // Org members: load their organizations + primary branch
  const { data: memberships } = await supabase
    .from('org_members')
    .select('organization_id, role, organizations(id, name, slug, onboarding_status, branches(id, name))')
    .eq('user_id', user!.id)
    .eq('status', 'active')

  if (!memberships || memberships.length === 0) {
    // No org yet — send to onboarding
    redirect('/onboarding')
  }

  if (memberships.length === 1) {
    const org    = (memberships[0] as any).organizations
    const branch = org?.branches?.[0]

    // Resume incomplete onboarding
    if (org?.onboarding_status && org.onboarding_status !== 'first_flow_active') {
      redirect('/onboarding/resume')
    }

    if (!branch) redirect('/org-selector')

    await setActiveContext(org.id, branch.id)
    redirect('/dashboard')
  }

  // Multiple organizations — let user choose
  redirect('/org-selector')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
