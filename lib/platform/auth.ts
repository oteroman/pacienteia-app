import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const IMPERSONATE_COOKIE = 'pa_impersonate'

export type PlatformRole = 'superadmin' | 'support' | 'sales'

export interface PlatformUser {
  id: string
  email: string
  platform_role: PlatformRole
}

/** Maps roles to human-readable labels */
export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  superadmin: 'Super Admin',
  support:    'Soporte',
  sales:      'Comercial',
}

/** Returns true if the user has at least one of the given roles. */
export function hasRole(user: PlatformUser, roles: PlatformRole[]): boolean {
  return roles.includes(user.platform_role)
}

/** Redirects to /platform if the user lacks the required role(s). */
export function requireRole(user: PlatformUser, roles: PlatformRole[]): void {
  if (!hasRole(user, roles)) redirect('/platform')
}

/** Returns the platform user if the current session has a platform_role, otherwise null. */
export async function getPlatformUser(): Promise<PlatformUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Primary: read from app_metadata in the JWT (set by service role, no DB call)
  const roleFromJwt = user.app_metadata?.platform_role as PlatformRole | undefined
  if (roleFromJwt) {
    return { id: user.id, email: user.email ?? '', platform_role: roleFromJwt }
  }

  // Fallback: check profiles table (covers users migrated before app_metadata was set)
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

/** Returns the organization_id being impersonated, or null. */
export async function getImpersonatedOrgId(): Promise<string | null> {
  const store = await cookies()
  return store.get(IMPERSONATE_COOKIE)?.value ?? null
}

/** @deprecated Use getImpersonatedOrgId */
export const getImpersonatedClinicId = getImpersonatedOrgId

export async function setImpersonatedOrgId(orgId: string): Promise<void> {
  const store = await cookies()
  store.set(IMPERSONATE_COOKIE, orgId, {
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
