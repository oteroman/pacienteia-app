/**
 * Backwards-compatibility shim.
 * All callers receive organization_id via getActiveClinicId();
 * they will be migrated to getActiveContext() incrementally.
 */
import {
  getActiveOrganizationId,
  setActiveOrganizationId,
  clearActiveContext,
} from './context'

export async function getActiveClinicId(): Promise<string | null> {
  return getActiveOrganizationId()
}

export async function setActiveClinicId(orgId: string): Promise<void> {
  return setActiveOrganizationId(orgId)
}

export async function clearActiveClinicId(): Promise<void> {
  return clearActiveContext()
}
