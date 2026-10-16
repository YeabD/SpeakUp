import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/practice') ||
    pathname.startsWith('/onboarding')

  const isAuthOrLandingPath =
    pathname === '/' || pathname === '/signup' || pathname === '/login'

  // 1. Unauthenticated users visiting protected paths -> redirect to /signup
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    return NextResponse.redirect(url)
  }

  // 2. Authenticated users visiting landing, signup, or login -> check active_language
  if (isAuthOrLandingPath && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_language')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    if (!profile || !profile.active_language) {
      url.pathname = '/onboarding/language'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
