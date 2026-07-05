import { NextRequest, NextResponse }          from 'next/server'
import { createAdminClient }                    from '@/lib/supabase/admin'
import { fetchAccounts, fetchLocations }        from '@/lib/google/business'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pacienteia.com'
const REDIRECT = (path: string) => NextResponse.redirect(`${APP_URL}${path}`)

// GET /api/auth/google-business/callback
// Handles the OAuth redirect from Google, exchanges the code for tokens,
// resolves the first Business Profile location, and saves the connection.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code           = searchParams.get('code')
  const organizationId = searchParams.get('state')
  const error          = searchParams.get('error')

  if (error || !code || !organizationId) {
    return REDIRECT('/settings/reputation?error=cancelled')
  }

  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  `${APP_URL}/api/auth/google-business/callback`,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) return REDIRECT('/settings/reputation?error=token_exchange')

  const tokens = await tokenRes.json() as {
    access_token:  string
    refresh_token?: string
    expires_in:    number
  }

  if (!tokens.refresh_token) {
    // Happens if user previously authorized and revoked — they need to revoke
    // access at myaccount.google.com/permissions first, then retry.
    return REDIRECT('/settings/reputation?error=no_refresh_token')
  }

  // Discover account + location automatically
  const accounts = await fetchAccounts(tokens.access_token)
  if (!accounts.length) return REDIRECT('/settings/reputation?error=no_accounts')

  const account     = accounts[0]
  const accountName = account.name   // "accounts/123456"

  const locations = await fetchLocations(tokens.access_token, accountName)
  if (!locations.length) return REDIRECT('/settings/reputation?error=no_locations')

  const location     = locations[0]
  const locationName = location.name   // "accounts/123456/locations/789"
  const locationId   = locationName.split('/').pop()!
  const accountId    = accountName.replace('accounts/', '')
  const displayName  = location.locationName ?? 'Ubicación principal'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('google_business_connections').upsert({
    organization_id:  organizationId,
    account_id:       accountId,
    location_id:      locationId,
    location_name:    displayName,
    refresh_token:    tokens.refresh_token,
    access_token:     tokens.access_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1_000).toISOString(),
    connected_at:     new Date().toISOString(),
  }, { onConflict: 'organization_id' })

  return REDIRECT('/settings/reputation?connected=true')
}
