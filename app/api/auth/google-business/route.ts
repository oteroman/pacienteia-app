import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { getActiveOrganizationId }    from '@/lib/tenant/context'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pacienteia.com'

// GET /api/auth/google-business
// Redirects the authenticated user to Google OAuth to connect their Business Profile.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return NextResponse.redirect(new URL('/org-selector', req.url))

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${APP_URL}/settings/reputation?error=not_configured`)
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${APP_URL}/api/auth/google-business/callback`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/business.manage',
    access_type:   'offline',
    prompt:        'consent',   // always request refresh_token
    state:         organizationId,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  )
}
