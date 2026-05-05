'use server'

import { setActiveClinicId } from '@/lib/tenant/active-clinic'

export async function setActiveClinicCookie(clinicId: string) {
  await setActiveClinicId(clinicId)
}
