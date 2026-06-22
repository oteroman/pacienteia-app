import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }          from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pacienteia.com'
const REDIR   = (path: string) => NextResponse.redirect(`${APP_URL}${path}`)

// GET /api/auth/facebook/callback
// 1. Exchange code → short-lived user token
// 2. Exchange → long-lived user token
// 3. Fetch managed pages → page access token (long-lived when derived from long-lived user token)
// 4. Fetch linked Instagram account ID
// 5. Save to social_connections
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code           = searchParams.get('code')
  const organizationId = searchParams.get('state')
  const error          = searchParams.get('error')

  if (error || !code || !organizationId) {
    return REDIR('/settings/social?error=cancelled')
  }

  const appId     = process.env.FACEBOOK_APP_ID!
  const appSecret = process.env.FACEBOOK_APP_SECRET!

  // Step 1: short-lived user token
  const tokenParams = new URLSearchParams({
    client_id:     appId,
    client_secret: appSecret,
    redirect_uri:  `${APP_URL}/api/auth/facebook/callback`,
    code,
  })
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams}`,
  )
  if (!tokenRes.ok) return REDIR('/settings/social?error=token_exchange')
  const { access_token: shortToken } = await tokenRes.json() as { access_token: string }

  // Step 2: long-lived user token (60 days)
  const llParams = new URLSearchParams({
    grant_type:        'fb_exchange_token',
    client_id:         appId,
    client_secret:     appSecret,
    fb_exchange_token: shortToken,
  })
  const llRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${llParams}`,
  )
  if (!llRes.ok) return REDIR('/settings/social?error=token_exchange')
  const { access_token: longToken } = await llRes.json() as { access_token: string }

  // Step 3: list managed pages (page tokens derived here are long-lived / never expire)
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}&fields=id,name,access_token`,
  )
  if (!pagesRes.ok) return REDIR('/settings/social?error=no_pages')
  const pagesData = await pagesRes.json() as { data?: { id: string; name: string; access_token: string }[] }
  const pages = pagesData.data ?? []
  if (!pages.length) return REDIR('/settings/social?error=no_pages')

  // Use first page (most clinics have one)
  const page = pages[0]

  // Step 4: get linked Instagram business account
  const igRes = await fetch(
    `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
  )
  let instagramAccountId: string | null = null
  if (igRes.ok) {
    const igData = await igRes.json() as { instagram_business_account?: { id: string } }
    instagramAccountId = igData.instagram_business_account?.id ?? null
  }

  // Step 5: save connection
  const sb = createAdminClient() as any
  await sb.from('social_connections').upsert({
    organization_id:      organizationId,
    platform:             'facebook',
    page_id:              page.id,
    page_name:            page.name,
    instagram_account_id: instagramAccountId,
    access_token:         page.access_token,
    profile_name:         page.name,
    is_active:            true,
    connected_at:         new Date().toISOString(),
    metadata: {
      instagram_linked: !!instagramAccountId,
      instagram_account_id: instagramAccountId,
    },
  }, { onConflict: 'organization_id,platform' })

  return REDIR('/settings/social?connected=facebook')
}
