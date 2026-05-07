'use server'

import { revalidatePath }       from 'next/cache'
import { createClient }         from '@/lib/supabase/server'
import { getActiveClinicId }    from '@/lib/tenant/active-clinic'
import { resolveRebooking }     from '@/lib/rebooking/index'
import type { RebookOutcome }   from '@/lib/rebooking/index'

export async function markRebookingOutcome(
  rebookingId: string,
  outcome:     Exclude<RebookOutcome, 'pending'>,
  _fd:         FormData,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const clinicId = await getActiveClinicId()
  if (!clinicId) return

  await resolveRebooking(rebookingId, clinicId, outcome)

  revalidatePath('/rebooking')
  revalidatePath('/ops')
}
