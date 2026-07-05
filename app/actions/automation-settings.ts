'use server'

import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import type { AutomationKey } from '@/lib/automation/settings'

export async function toggleAutomation(formData: FormData): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) return

  const key        = formData.get('key')        as AutomationKey | null
  const isEnabled  = formData.get('is_enabled') as string | null
  if (!key) return

  const newValue = isEnabled !== 'true'   // toggle: if currently true → set false

  const sb = createAdminClient() as any   // eslint-disable-line @typescript-eslint/no-explicit-any
  await sb
    .from('automation_settings')
    .upsert(
      {
        organization_id: ctx.organizationId,
        branch_id:       ctx.branchId,
        automation_key:  key,
        is_enabled:      newValue,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'organization_id,branch_id,automation_key' },
    )

  revalidatePath('/settings/automations')
}
