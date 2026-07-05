import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ORG_COOKIE, BRANCH_COOKIE, COOKIE_OPTS } from '@/lib/tenant/context'

/**
 * Sets the active-context cookies for a single-org/single-branch user and
 * forwards to the dashboard. Cookies are written here (a Route Handler) because
 * Next 15 forbids writing them during a Server Component render — which is why
 * /org-selector redirects here instead of setting them inline.
 *
 * On any failure it falls back to the picker with ?pick=1, which stops
 * /org-selector from auto-forwarding again (avoids a redirect loop).
 */
export async function GET(req: NextRequest) {
  const orgId    = req.nextUrl.searchParams.get('org')
  const branchId = req.nextUrl.searchParams.get('branch')
  const picker   = NextResponse.redirect(new URL('/org-selector?pick=1', req.url))

  if (!orgId || !branchId) return picker

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  // Anti-IDOR: trust the ids from the query string only after confirming the
  // user is an active member of this org and the branch belongs to it.
  const { data: membership } = await supabase
    .from('org_members')
    .select('organization_id, organizations ( branches ( id ) )')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branches = (((membership as any)?.organizations?.branches) ?? []) as { id: string }[]
  if (!membership || !branches.some((b) => b.id === branchId)) return picker

  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  res.cookies.set(ORG_COOKIE,    orgId,    COOKIE_OPTS)
  res.cookies.set(BRANCH_COOKIE, branchId, COOKIE_OPTS)
  return res
}
