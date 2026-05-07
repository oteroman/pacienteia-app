'use server'

import { revalidatePath } from 'next/cache'
import { fetchAllClinicValue } from '@/lib/customer-health/value'
import { syncValueSignalTasks } from '@/lib/customer-health/signals'

export async function syncSignalTasks(): Promise<void> {
  const clinics = await fetchAllClinicValue()
  await syncValueSignalTasks(clinics)
  revalidatePath('/analytics/value')
  revalidatePath('/analytics/playbook')
}
