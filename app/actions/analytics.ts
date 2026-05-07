'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import type { GatingEventPayload } from '@/lib/analytics/gating'

/**
 * Fire-and-forget analytics tracker. Call with `void trackGatingEvent(...)`.
 * Never throws — errors are swallowed so analytics never breaks the UI.
 */
export async function trackGatingEvent(payload: GatingEventPayload): Promise<void> {
  try {
    const [clinicId, supabase] = await Promise.all([
      getActiveClinicId(),
      createClient(),
    ])
    if (!clinicId) return

    const { data: { user } } = await supabase.auth.getUser()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('gating_events').insert({
      clinic_id:   clinicId,
      user_id:     user?.id ?? null,
      event:       payload.event,
      resource:    payload.resource    ?? null,
      gate_state:  payload.gate_state  ?? null,
      operation:   payload.operation   ?? null,
      source_page: payload.source_page ?? null,
      metadata:    payload.metadata    ?? null,
    })
  } catch {
    // Intentional: analytics must never crash the UI
  }
}
