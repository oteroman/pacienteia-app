'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'

export async function addScheduleBlock(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const organizationId = await getActiveOrganizationId()
  const branchId = await getActiveBranchId()
  if (!organizationId || !branchId) redirect('/clinic-selector')

  const block_date  = formData.get('block_date') as string
  const start_time  = (formData.get('start_time') as string) || null
  const end_time    = (formData.get('end_time') as string) || null
  const reason      = (formData.get('reason') as string) || null
  const block_type  = (formData.get('block_type') as string) || 'other'
  const doctor_name = (formData.get('doctor_name') as string) || null

  if (!block_date) return

  const admin = createAdminClient()
  await (admin as any)
    .from('schedule_blocks')
    .insert({
      organization_id: organizationId,
      branch_id:       branchId,
      block_date,
      start_time:  start_time  || null,
      end_time:    end_time    || null,
      reason:      reason      || null,
      block_type,
      doctor_name: doctor_name || null,
    })

  revalidatePath('/settings/schedules')
  redirect('/settings/schedules?saved=1')
}

export async function deleteScheduleBlock(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const id = formData.get('id') as string
  if (!id) return

  const admin = createAdminClient()
  await (admin as any)
    .from('schedule_blocks')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  revalidatePath('/settings/schedules')
}

export async function addDoctorSchedule(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const organizationId = await getActiveOrganizationId()
  const branchId = await getActiveBranchId()
  if (!organizationId || !branchId) redirect('/clinic-selector')

  const professional_id = formData.get('professional_id') as string
  const day_of_week     = parseInt(formData.get('day_of_week') as string)
  const start_time      = formData.get('start_time') as string
  const end_time        = formData.get('end_time') as string

  if (!professional_id || isNaN(day_of_week) || !start_time || !end_time) return

  const admin = createAdminClient()

  const { data: pro } = await (admin as any)
    .from('professionals')
    .select('name')
    .eq('id', professional_id)
    .single()

  const doctor_name = pro?.name ?? ''

  await (admin as any)
    .from('doctor_schedules')
    .insert({
      organization_id: organizationId,
      branch_id:       branchId,
      professional_id,
      doctor_name,
      day_of_week,
      start_time,
      end_time,
      is_active: true,
    })

  revalidatePath('/settings/schedules')
  redirect('/settings/schedules?saved=1')
}

export async function deleteDoctorSchedule(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  const id = formData.get('id') as string
  if (!id) return

  const admin = createAdminClient()
  await (admin as any)
    .from('doctor_schedules')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  revalidatePath('/settings/schedules')
}
