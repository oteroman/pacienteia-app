'use server'

import { revalidatePath }    from 'next/cache'
import { createClient }      from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fillSlot, expireSlot } from '@/lib/backfill/index'

export async function markSlotFilled(
  slotId:            string,
  selectedPatientId: string,
  _fd: FormData,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  await fillSlot(slotId, clinicId, selectedPatientId)

  revalidatePath('/backfill')
  revalidatePath('/ops')
}

export async function markSlotExpired(slotId: string, _fd: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  await expireSlot(slotId, clinicId)

  revalidatePath('/backfill')
}
