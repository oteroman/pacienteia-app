'use server'

import { revalidatePath }    from 'next/cache'
import { redirect }          from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'

export async function createTemplate(formData: FormData): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')

  const name     = (formData.get('name')     as string | null)?.trim()
  const body     = (formData.get('body')     as string | null)?.trim()
  const category = (formData.get('category') as string | null) ?? 'general'

  if (!name || !body) return

  const sb = createAdminClient() as any
  await sb.from('message_templates').insert({
    organization_id: ctx.organizationId,
    branch_id:       ctx.branchId,
    name,
    body,
    category,
  })

  revalidatePath('/settings/messages')
  redirect('/settings/messages?saved=1')
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) return

  const id = formData.get('id') as string | null
  if (!id) return

  const sb = createAdminClient() as any
  await sb
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)

  revalidatePath('/settings/messages')
}

export async function toggleTemplateActive(formData: FormData): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) return

  const id        = formData.get('id')        as string | null
  const isActive  = formData.get('is_active') as string | null
  if (!id) return

  const sb = createAdminClient() as any
  await sb
    .from('message_templates')
    .update({ is_active: isActive !== 'true', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)

  revalidatePath('/settings/messages')
}
