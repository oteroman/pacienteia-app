import { cookies } from 'next/headers'

const COOKIE_NAME = 'active_clinic_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function getActiveClinicId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}

export async function setActiveClinicId(clinicId: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, clinicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

export async function clearActiveClinicId(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
