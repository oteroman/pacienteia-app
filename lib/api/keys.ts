import { randomBytes, createHash } from 'node:crypto'
import { createAdminClient }       from '@/lib/supabase/admin'

/** Generate a new API key. Returns the raw key (shown once) plus the hash stored in DB. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw    = randomBytes(32).toString('base64url')
  const key    = `paia_${raw}`
  const hash   = createHash('sha256').update(key).digest('hex')
  const prefix = key.slice(0, 12)
  return { key, hash, prefix }
}

/** Validate an API key from a request. Returns organizationId or null if invalid/revoked. */
export async function validateApiKey(key: string): Promise<{ organizationId: string } | null> {
  if (!key.startsWith('paia_')) return null

  const hash = createHash('sha256').update(key).digest('hex')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data } = await sb
    .from('api_keys')
    .select('id, organization_id')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .single()

  if (!data) return null

  // Update last_used_at fire-and-forget
  sb.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return { organizationId: data.organization_id }
}
