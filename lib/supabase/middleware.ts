import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

function isPublicAuthPath(pathname: string) {
  return pathname.startsWith('/auth') || pathname.startsWith('/login')
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

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
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
    }
  )

  // Refresca la sesión y valida el JWT (no usar getSession() en el servidor para
  // decisiones de seguridad). Ver:
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  //
  // Do not run code between createServerClient and supabase.auth.getClaims().
  const { data, error } = await supabase.auth.getClaims()

  if (error && isStaleSessionAuthError(error)) {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      /* ignore */
    }
  }

  const user = data?.claims

  if (
    !user &&
    !isPublicAuthPath(request.nextUrl.pathname)
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
