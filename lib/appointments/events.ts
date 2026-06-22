import { createAdminClient } from '@/lib/supabase/admin'

export type AppointmentEventType =
  | 'created'
  | 'status_changed'
  | 'notes_updated'
  | 'rescheduled'
  | 'payment_received'
  | 'cancelled'

export async function logAppointmentEvent(opts: {
  appointmentId:  string
  organizationId: string
  eventType:      AppointmentEventType
  details?:       Record<string, unknown>
  actor?:         string
}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    await sb.from('appointment_events').insert({
      appointment_id:  opts.appointmentId,
      organization_id: opts.organizationId,
      event_type:      opts.eventType,
      details:         opts.details ?? {},
      actor:           opts.actor ?? 'system',
    })
  } catch (err) {
    console.error('[appointment-events] log failed:', err)
  }
}
