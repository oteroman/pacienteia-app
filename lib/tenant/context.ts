/**
 * Tenant context helpers.
 * Replaces active-clinic.ts with organization + branch model.
 *
 * Cookies:
 *   active_organization_id  — the selected organization UUID
 *   active_branch_id        — the selected branch UUID within that org
 *
 * Both cookies are set together when a user selects a context.
 * Branch can be changed without losing the organization.
 */

import { cookies } from 'next/headers'

const ORG_COOKIE    = 'active_organization_id'
const BRANCH_COOKIE = 'active_branch_id'
const MAX_AGE       = 60 * 60 * 24 * 30  // 30 days

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
}

// ─── Read ─────────────────────────────────────────────────────────────────

export async function getActiveOrganizationId(): Promise<string | null> {
  const store = await cookies()
  return store.get(ORG_COOKIE)?.value ?? null
}

export async function getActiveBranchId(): Promise<string | null> {
  const store = await cookies()
  return store.get(BRANCH_COOKIE)?.value ?? null
}

export interface ActiveContext {
  organizationId: string
  branchId: string
}

/** Returns both IDs or null if either is missing. */
export async function getActiveContext(): Promise<ActiveContext | null> {
  const store = await cookies()
  const organizationId = store.get(ORG_COOKIE)?.value
  const branchId       = store.get(BRANCH_COOKIE)?.value
  if (!organizationId || !branchId) return null
  return { organizationId, branchId }
}

// ─── Write ────────────────────────────────────────────────────────────────

export async function setActiveContext(organizationId: string, branchId: string): Promise<void> {
  const store = await cookies()
  store.set(ORG_COOKIE,    organizationId, COOKIE_OPTS)
  store.set(BRANCH_COOKIE, branchId,       COOKIE_OPTS)
}

export async function setActiveOrganizationId(organizationId: string): Promise<void> {
  const store = await cookies()
  store.set(ORG_COOKIE, organizationId, COOKIE_OPTS)
}

export async function setActiveBranchId(branchId: string): Promise<void> {
  const store = await cookies()
  store.set(BRANCH_COOKIE, branchId, COOKIE_OPTS)
}

// ─── Clear ────────────────────────────────────────────────────────────────

export async function clearActiveContext(): Promise<void> {
  const store = await cookies()
  store.delete(ORG_COOKIE)
  store.delete(BRANCH_COOKIE)
}

// ─── Backwards-compat shim (used by platform impersonation) ──────────────
// The impersonation cookie pa_impersonate carries a JSON payload now.
// Legacy code that called setActiveClinicId / getActiveClinicId during
// impersonation must be migrated to setActiveContext.
export { setActiveContext as setActiveClinicId_DEPRECATED }
