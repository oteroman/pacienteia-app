import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be called before any redirect to avoid auth loops
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Platform admins (platform_role in app_metadata JWT) must always go to /platform
  // unless they're already there, logging out, or in impersonation mode
  const isPlatformAdmin = !!(user?.app_metadata?.platform_role)
  const isImpersonating = !!request.cookies.get('pa_impersonate')?.value

  if (isPlatformAdmin && !isImpersonating) {
    const onPlatform = pathname.startsWith('/platform')
    const onAuth    = pathname.startsWith('/login') || pathname.startsWith('/auth/')
    const onAnalytics = pathname.startsWith('/analytics')
    // Let platform admins through to /platform, /analytics/admin, and auth routes
    if (!onPlatform && !onAuth && !onAnalytics) {
      return NextResponse.redirect(new URL('/platform', request.url))
    }
  }

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/auth/')
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/patients') ||
    pathname.startsWith('/appointments') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/blocked') ||
    pathname.startsWith('/platform') ||
    pathname.startsWith('/clinic-selector') ||
    pathname === '/'

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && !isPlatformAdmin && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && isPlatformAdmin && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/platform', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
