'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import type { GatingEventPayload } from '@/lib/analytics/gating'

export async function trackGatingEvent(payload: GatingEventPayload): Promise<void> {
  try {
    const [orgId, supabase] = await Promise.all([
      getActiveClinicId(),
      createClient(),
    ])
    if (!orgId) return

    const { data: { user } } = await supabase.auth.getUser()

    await (supabase as any).from('gating_events').insert({
      organization_id: orgId,
      user_id:         user?.id ?? null,
      event:           payload.event,
      resource:        payload.resource    ?? null,
      gate_state:      payload.gate_state  ?? null,
      operation:       payload.operation   ?? null,
      source_page:     payload.source_page ?? null,
      metadata:        payload.metadata    ?? null,
    })
  } catch {
    // analytics must never crash the UI
  }
}
