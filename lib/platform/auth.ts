import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const IMPERSONATE_COOKIE = 'pa_impersonate'

export type PlatformRole = 'superadmin' | 'support'

export interface PlatformUser {
  id: string
  email: string
  platform_role: PlatformRole
}

/** Returns the platform user if the current session has a platform_role, otherwise null. */
export async function getPlatformUser(): Promise<PlatformUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const sb = createAdminClient() as any
  const { data: profile } = await sb
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single()

  if (!profile?.platform_role) return null

  return {
    id: user.id,
    email: user.email ?? '',
    platform_role: profile.platform_role as PlatformRole,
  }
}

/** Throws redirect to /login if not authenticated as platform admin. */
export async function requirePlatformAdmin(): Promise<PlatformUser> {
  const pu = await getPlatformUser()
  if (!pu) redirect('/login')
  return pu
}

/** Returns the clinic_id being impersonated, or null. */
export async function getImpersonatedClinicId(): Promise<string | null> {
  const store = await cookies()
  return store.get(IMPERSONATE_COOKIE)?.value ?? null
}

export async function setImpersonatedClinicId(clinicId: string): Promise<void> {
  const store = await cookies()
  store.set(IMPERSONATE_COOKIE, clinicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h max impersonation session
  })
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies()
  store.delete(IMPERSONATE_COOKIE)
}
