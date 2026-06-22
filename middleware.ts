import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Public API — authenticated via X-API-Key, not session
  if (pathname.startsWith('/api/v1/')) return response

  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/invite/')

  // For public/auth paths use getSession() (cookie-only, no network round-trip).
  // For protected paths use getUser() (validates with Supabase server).
  let user: { app_metadata?: Record<string, unknown> } | null = null
  if (isPublicPath || pathname === '/') {
    const { data: { session } } = await supabase.auth.getSession()
    user = session?.user ?? null
  } else {
    const { data: { user: u } } = await supabase.auth.getUser()
    user = u
  }

  // ── Platform admin routing ─────────────────────────────────────────────
  // platform_role is in JWT app_metadata — no DB call needed
  const isPlatformAdmin = !!(user?.app_metadata?.platform_role)
  const isImpersonating = !!request.cookies.get('pa_impersonate')?.value

  if (isPlatformAdmin && !isImpersonating) {
    const onPlatform   = pathname.startsWith('/platform')
    const onAuth       = pathname.startsWith('/login') || pathname.startsWith('/auth/')
    const onAnalytics  = pathname.startsWith('/analytics')
    const onOnboarding = pathname.startsWith('/onboarding')
    const onApi        = pathname.startsWith('/api/')
    if (!onPlatform && !onAuth && !onAnalytics && !onOnboarding && !onApi) {
      return NextResponse.redirect(new URL('/platform', request.url))
    }
  }

  // ── Auth routing ───────────────────────────────────────────────────────
  // Unauthenticated users hitting /onboarding go to /signup first
  if (!user && pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/signup', request.url))
  }

  // Root / — authenticated users go to dashboard, unauthenticated go to login
  if (pathname === '/') {
    if (user && !isPlatformAdmin) return NextResponse.redirect(new URL('/dashboard', request.url))
    if (user && isPlatformAdmin) return NextResponse.redirect(new URL('/platform', request.url))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/patients') ||
    pathname.startsWith('/appointments') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/inbox') ||
    pathname.startsWith('/copilot') ||
    pathname.startsWith('/backfill') ||
    pathname.startsWith('/activity') ||
    pathname.startsWith('/waiting-room') ||
    pathname.startsWith('/opportunities') ||
    pathname.startsWith('/rebooking') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/blocked') ||
    pathname.startsWith('/platform') ||
    pathname.startsWith('/org-selector')

  // Unauthenticated → login
  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users don't need login or signup
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')

  if (user && isPlatformAdmin && isAuthPage) {
    return NextResponse.redirect(new URL('/platform', request.url))
  }

  if (user && !isPlatformAdmin && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Onboarding gate ────────────────────────────────────────────────────
  // Clinic users with no active_organization_id cookie on protected paths
  // must complete onboarding or select an org.
  // Exception: /org-selector and /onboarding paths are already allowed.
  if (user && !isPlatformAdmin && isProtectedPath) {
    const hasOrg    = !!request.cookies.get('active_organization_id')?.value
    const hasBranch = !!request.cookies.get('active_branch_id')?.value

    const needsContext =
      !pathname.startsWith('/org-selector') &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/invite/')

    if (needsContext && (!hasOrg || !hasBranch)) {
      return NextResponse.redirect(new URL('/org-selector', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
