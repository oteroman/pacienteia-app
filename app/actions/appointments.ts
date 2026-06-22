'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext } from '@/lib/tenant/context'
import { appointmentSchema, type AppointmentFormValues } from '@/lib/validations/appointment'
import { triggerBackfill } from '@/lib/backfill'
import { logAppointmentEvent } from '@/lib/appointments/events'
import type { AppointmentStatus } from '@/types/database'

async function getContext() {
  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  return ctx
}

function mut(client: Awaited<ReturnType<typeof createClient>>) {
  return client as any
}

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

async function checkScheduleBlock(
  organizationId: string,
  branchId: string,
  scheduledAt: string,
  professionalId: string | null | undefined,
): Promise<string | null> {
  const [datePart, timePart] = scheduledAt.split('T')
  const appointmentDate = datePart
  const appointmentTime = timePart?.slice(0, 5) ?? null
  const sb = createAdminClient() as any

  let professionalName: string | null = null
  if (professionalId) {
    const { data: pro } = await sb.from('professionals').select('name').eq('id', professionalId).single()
    professionalName = pro?.name ?? null
  }

  // ── 1. Schedule blocks (blocked dates / holidays) ────────────────────────
  const { data: blocks } = await sb
    .from('schedule_blocks')
    .select('start_time, end_time, doctor_name, block_type')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .eq('block_date', appointmentDate)

  for (const block of blocks ?? []) {
    const appliesToPro = !block.doctor_name || block.doctor_name === professionalName
    if (!appliesToPro) continue

    if (!block.start_time || !block.end_time) {
      const who = block.doctor_name ?? 'la clínica'
      return `Este día está bloqueado para ${who}. No se pueden agendar citas.`
    }

    if (appointmentTime && appointmentTime >= block.start_time.slice(0, 5) && appointmentTime < block.end_time.slice(0, 5)) {
      return `El horario ${appointmentTime} está bloqueado ese día (${block.start_time.slice(0, 5)}–${block.end_time.slice(0, 5)}).`
    }
  }

  // ── 2. Working hours validation ──────────────────────────────────────────
  if (professionalId && appointmentTime) {
    const [year, month, day] = datePart.split('-').map(Number)
    const dayOfWeek = new Date(year, month - 1, day).getDay()

    // Fetch ALL active schedules for this professional (to detect if any are configured)
    const { data: allSchedules } = await sb
      .from('doctor_schedules')
      .select('day_of_week, start_time, end_time, doctor_name')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('professional_id', professionalId)
      .eq('is_active', true)

    if (allSchedules && allSchedules.length > 0) {
      const todaySchedules = allSchedules.filter((s: { day_of_week: number }) => s.day_of_week === dayOfWeek)
      const proName = allSchedules[0].doctor_name ?? 'El profesional'

      if (todaySchedules.length === 0) {
        return `${proName} no atiende los ${DAY_NAMES_ES[dayOfWeek]}.`
      }

      const withinHours = todaySchedules.some(
        (s: { start_time: string; end_time: string }) =>
          appointmentTime >= s.start_time.slice(0, 5) && appointmentTime < s.end_time.slice(0, 5)
      )
      if (!withinHours) {
        const ranges = todaySchedules
          .map((s: { start_time: string; end_time: string }) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`)
          .join(', ')
        return `${proName} atiende de ${ranges} los ${DAY_NAMES_ES[dayOfWeek]}. El horario ${appointmentTime} está fuera de su agenda.`
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  return null
}

export async function createAppointment(data: AppointmentFormValues) {
  const { organizationId, branchId } = await getContext()
  const parsed = appointmentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { notes, price, professional_id, ...rest } = parsed.data

  const blockError = await checkScheduleBlock(organizationId, branchId, rest.scheduled_at, professional_id)
  if (blockError) return { error: blockError }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: inserted, error } = await mut(supabase).from('appointments').insert({
    ...rest,
    organization_id: organizationId,
    branch_id:       branchId,
    notes:           notes || null,
    price:           price ?? null,
    professional_id: professional_id || null,
  }).select('id').single()

  if (error) return { error: error.message }

  logAppointmentEvent({
    appointmentId:  inserted.id,
    organizationId,
    eventType:      'created',
    details:        { treatment_type: rest.treatment_type, scheduled_at: rest.scheduled_at },
    actor:          user?.email ?? 'staff',
  }).catch(() => {})

  revalidatePath('/appointments')
  redirect('/appointments')
}

export async function updateAppointment(id: string, data: AppointmentFormValues) {
  const { organizationId, branchId } = await getContext()
  const parsed = appointmentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { notes, price, professional_id, ...rest } = parsed.data

  const blockError = await checkScheduleBlock(organizationId, branchId, rest.scheduled_at, professional_id)
  if (blockError) return { error: blockError }

  const supabase = await createClient()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ ...rest, notes: notes || null, price: price ?? null, professional_id: professional_id || null })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) return { error: error.message }
  revalidatePath('/appointments')
  revalidatePath(`/appointments/${id}`)
  redirect(`/appointments/${id}`)
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const { organizationId, branchId } = await getContext()
  const supabase = await createClient()

  // Fetch appointment details before the update so we can trigger backfill if needed
  let aptForBackfill: { treatment_type: string; scheduled_at: string } | null = null
  if (status === 'cancelled' || status === 'no_show') {
    const { data } = await mut(supabase)
      .from('appointments')
      .select('treatment_type, scheduled_at')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()
    aptForBackfill = data ?? null
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) return { error: error.message }

  logAppointmentEvent({
    appointmentId:  id,
    organizationId,
    eventType:      status === 'cancelled' ? 'cancelled' : 'status_changed',
    details:        { status },
    actor:          user?.email ?? 'staff',
  }).catch(() => {})

  // Fire backfill asynchronously — don't await so the UI isn't blocked
  if (aptForBackfill && branchId) {
    triggerBackfill({
      organizationId,
      branchId,
      appointmentId:  id,
      treatmentType:  aptForBackfill.treatment_type,
      slotStart:      aptForBackfill.scheduled_at,
      reasonOpened:   status === 'cancelled' ? 'cancellation' : 'no_show',
    }).catch((err) => console.error('[backfill trigger]', err))
  }

  revalidatePath('/appointments')
  revalidatePath('/patients')
  revalidatePath('/dashboard')
}

export async function saveAppointmentNotes(
  id: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const { organizationId } = await getContext()
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ notes })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) return { ok: false, error: error.message }

  logAppointmentEvent({
    appointmentId:  id,
    organizationId,
    eventType:      'notes_updated',
    details:        { hasNotes: !!notes },
    actor:          user?.email ?? 'staff',
  }).catch(() => {})

  revalidatePath(`/appointments/${id}`)
  return { ok: true }
}

export async function cancelAppointment(id: string): Promise<void> {
  const { organizationId, branchId } = await getContext()
  const supabase = await createClient()

  // Fetch before update for backfill
  const { data: apt } = await mut(supabase)
    .from('appointments')
    .select('treatment_type, scheduled_at')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await mut(supabase)
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[cancelAppointment]', error.message)
    revalidatePath('/appointments')
    revalidatePath('/dashboard')
    return
  }

  logAppointmentEvent({
    appointmentId:  id,
    organizationId,
    eventType:      'cancelled',
    details:        {},
    actor:          user?.email ?? 'staff',
  }).catch(() => {})

  if (apt && branchId) {
    triggerBackfill({
      organizationId,
      branchId,
      appointmentId: id,
      treatmentType:  apt.treatment_type,
      slotStart:      apt.scheduled_at,
      reasonOpened:  'cancellation',
    }).catch((err) => console.error('[backfill trigger]', err))
  }

  revalidatePath('/appointments')
  revalidatePath('/dashboard')
}

export async function dragRescheduleAppointment(
  id: string,
  newScheduledAt: string,
): Promise<{ ok: boolean; error?: string }> {
  const { organizationId } = await getContext()
  const sb = createAdminClient() as any
  const { error } = await sb
    .from('appointments')
    .update({ scheduled_at: newScheduledAt })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/calendar')
  revalidatePath('/dashboard')
  return { ok: true }
}
