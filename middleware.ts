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

  // Refresh session — must run before any redirect to avoid auth loops
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Platform admin routing ─────────────────────────────────────────────
  // platform_role is in JWT app_metadata — no DB call needed
  const isPlatformAdmin = !!(user?.app_metadata?.platform_role)
  const isImpersonating = !!request.cookies.get('pa_impersonate')?.value

  if (isPlatformAdmin && !isImpersonating) {
    const onPlatform   = pathname.startsWith('/platform')
    const onAuth       = pathname.startsWith('/login') || pathname.startsWith('/auth/')
    const onAnalytics  = pathname.startsWith('/analytics')
    const onOnboarding = pathname.startsWith('/onboarding')
    if (!onPlatform && !onAuth && !onAnalytics && !onOnboarding) {
      return NextResponse.redirect(new URL('/platform', request.url))
    }
  }

  // ── Auth routing ───────────────────────────────────────────────────────
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/onboarding') ||   // registration + onboarding wizard
    pathname.startsWith('/invite/')         // invitation accept link

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/patients') ||
    pathname.startsWith('/appointments') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/blocked') ||
    pathname.startsWith('/platform') ||
    pathname.startsWith('/org-selector') ||
    pathname === '/'

  // Unauthenticated → login
  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated platform admin → /platform (not /dashboard)
  if (user && isPlatformAdmin && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/platform', request.url))
  }

  // Authenticated clinic user → /dashboard
  if (user && !isPlatformAdmin && pathname.startsWith('/login')) {
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
