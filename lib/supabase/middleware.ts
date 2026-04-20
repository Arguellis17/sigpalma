import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

function isPublicAuthPath(pathname: string) {
  return pathname.startsWith('/auth') || pathname === '/login'
}

/** Refresh/session errors where cookies should be cleared to avoid a broken half-session. */
function isStaleSessionAuthError(error: { code?: string } | null) {
  const code = error?.code
  return (
    code === 'refresh_token_not_found' ||
    code === 'invalid_refresh_token' ||
    code === 'invalid_grant'
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              supabaseResponse.headers.set(key, value)
            }
          }
        },
      },
      auth: { debug: false },
    }
  )

  const { data, error } = await supabase.auth.getClaims()

  if (error && isStaleSessionAuthError(error)) {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      /* ignore */
    }
  }

  const user = data?.claims
  const pathname = request.nextUrl.pathname

  // Unauthenticated: redirect to login (except public auth paths)
  if (!user && !isPublicAuthPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Authenticated user hitting the root: redirect to role dashboard
  if (user && pathname === '/') {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.sub as string)
      .maybeSingle()

    const role = profileData?.role
    const dashboardMap: Record<string, string> = {
      superadmin: '/superadmin',
      admin:      '/admin',
      agronomo:   '/tecnico',
      operario:   '/operario',
    }
    const dest = role ? (dashboardMap[role] ?? '/operario') : '/operario'
    const url = request.nextUrl.clone()
    url.pathname = dest
    return NextResponse.redirect(url)
  }

  // Authenticated user hitting /auth/* paths: redirect to their dashboard
  if (user && isPublicAuthPath(pathname)) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.sub as string)
      .maybeSingle()

    const role = profileData?.role
    const dashboardMap: Record<string, string> = {
      superadmin: '/superadmin',
      admin:      '/admin',
      agronomo:   '/tecnico',
      operario:   '/operario',
    }
    const dest = role ? (dashboardMap[role] ?? '/operario') : '/operario'
    const url = request.nextUrl.clone()
    url.pathname = dest
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

