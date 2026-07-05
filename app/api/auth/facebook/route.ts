import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { getActiveOrganizationId }    from '@/lib/tenant/context'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pacienteia.com'

// GET /api/auth/facebook
// Redirects the authenticated org admin to Facebook OAuth to connect their Page.
// One connection covers both Facebook Messenger and Instagram DMs.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return NextResponse.redirect(new URL('/org-selector', req.url))

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    return NextResponse.redirect(`${APP_URL}/settings/social?error=not_configured`)
  }

  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  `${APP_URL}/api/auth/facebook/callback`,
    state:         organizationId,
    response_type: 'code',
    scope: [
      'pages_show_list',
      'pages_messaging',
      'pages_manage_metadata',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_manage_messages',
      'leads_retrieval',
    ].join(','),
  })

  return NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params}`,
  )
}
