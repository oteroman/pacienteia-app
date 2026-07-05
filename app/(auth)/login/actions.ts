'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setActiveContext } from '@/lib/tenant/context'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

const APP_URL = 'https://app.pacienteia.com'

interface LoginState {
  error: string | null
}

// ── Email + password login ───────────────────────────────────────────────────

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email y contraseña son requeridos' }

  const supabase = await createClient()
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.app_metadata?.platform_role) redirect('/platform')

  const sb = createAdminClient() as any
  const { data: profile } = await sb.from('profiles').select('platform_role').eq('id', user!.id).single()
  if (profile?.platform_role) redirect('/platform')

  const { data: memberships } = await supabase
    .from('org_members')
    .select('organization_id, role, organizations(id, name, slug, onboarding_status, branches(id, name))')
    .eq('user_id', user!.id)
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

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ── Email signup ─────────────────────────────────────────────────────────────

export async function signUp(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email    = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email)                          return { error: 'El email es requerido' }
  if (!password || password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }

  const headersList = await headers()
  const origin      = headersList.get('origin') ?? APP_URL

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'Ya existe una cuenta con este email. Inicia sesión.' }
    }
    return { error: error.message }
  }

  if (data.session) redirect('/onboarding')
  redirect(`/check-email?email=${encodeURIComponent(email)}&type=signup`)
}

// ── Magic link ───────────────────────────────────────────────────────────────

export async function sendMagicLink(
  _prevState: { error: string | null; sent?: boolean },
  formData: FormData,
): Promise<{ error: string | null; sent?: boolean }> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) return { error: 'El email es requerido' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${APP_URL}/auth/callback?next=/auth/post-login`,
      shouldCreateUser: true,
    },
  })

  if (error) return { error: error.message }
  return { error: null, sent: true }
}

// ── Password reset ───────────────────────────────────────────────────────────

export async function resetPassword(
  _prevState: { error: string | null; sent?: boolean },
  formData: FormData,
): Promise<{ error: string | null; sent?: boolean }> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) return { error: 'El email es requerido' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?next=/update-password`,
  })

  // Don't reveal whether email exists
  if (error && !error.message.includes('rate limit')) return { error: null, sent: true }
  return { error: null, sent: true }
}
