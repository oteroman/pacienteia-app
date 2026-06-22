'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createClient }   from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { generateApiKey }    from '@/lib/api/keys'

async function ctx() {
  const c = await getActiveContext()
  if (!c) redirect('/org-selector')
  return c
}

export async function createApiKey(formData: FormData) {
  const { organizationId } = await ctx()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const name = (formData.get('name') as string)?.trim()
  if (!name) return

  const { key, hash, prefix } = generateApiKey()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  await sb.from('api_keys').insert({
    organization_id: organizationId,
    name,
    key_hash:   hash,
    key_prefix: prefix,
    created_by: user.id,
  })

  revalidatePath('/settings/api-keys')
  redirect(`/settings/api-keys?new_key=${encodeURIComponent(key)}`)
}

export async function revokeApiKey(formData: FormData) {
  const { organizationId } = await ctx()
  const id = formData.get('id') as string
  if (!id) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)

  revalidatePath('/settings/api-keys')
}
