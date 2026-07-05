import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin }       from '@/lib/platform/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pacienteia.com'

// GET /api/auth/facebook/platform
// Superadmin-only: connects PacienteIA's own Facebook Page to receive Messenger + Instagram
// messages from prospects, which flow into the Paxi sales bot.
export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin()
  } catch {
    return NextResponse.redirect(new URL('/platform', req.url))
  }

  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    return NextResponse.redirect(`${APP_URL}/platform/social?error=not_configured`)
  }

  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  `${APP_URL}/api/auth/facebook/platform/callback`,
    state:         'platform',
    response_type: 'code',
    scope: [
      'pages_show_list',
      'pages_messaging',
      'pages_manage_metadata',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_manage_messages',
    ].join(','),
  })

  return NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params}`,
  )
}
