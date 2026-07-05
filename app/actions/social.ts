'use server'

import { revalidatePath }    from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'

export async function disconnectSocial(platform: string, orgId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const sb = createAdminClient() as any
  await sb
    .from('social_connections')
    .update({ is_active: false })
    .eq('organization_id', orgId)
    .eq('platform', platform)

  revalidatePath('/settings/social')
}
