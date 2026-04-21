import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

function isPublicAuthPath(pathname: string) {
  return pathname.startsWith("/auth") || pathname === "/login";
}

/** Refresh/session errors where cookies should be cleared to avoid a broken half-session. */
function isStaleSessionAuthError(error: { code?: string } | null) {
  const code = error?.code;
  return (
    code === "refresh_token_not_found" ||
    code === "invalid_refresh_token" ||
    code === "invalid_grant"
  );
}

const dashboardMap: Record<string, string> = {
  superadmin: "/superadmin",
  admin: "/admin",
  agronomo: "/tecnico",
  operario: "/operario",
};

const CHANGE_PASSWORD_PATH = "/auth/cambiar-contrasena";

type SessionGate = {
  activeRole: string | null;
  mustChangePassword: boolean;
};

/** Role + bandera RN07 (must_change_password en profiles). */
async function getSessionGate(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string
): Promise<SessionGate> {
  const { data } = await supabase
    .from("profiles")
    .select("role, is_active, must_change_password")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_active) {
    return { activeRole: null, mustChangePassword: false };
  }
  return {
    activeRole: data.role,
    mustChangePassword: Boolean(data.must_change_password),
  };
}

function redirectPreservingAuthCookies(
  request: NextRequest,
  pathname: string,
  cookieSource: NextResponse
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const res = NextResponse.redirect(url);
  cookieSource.cookies.getAll().forEach((c) => {
    res.cookies.set(c.name, c.value);
  });
  return res;
}

function isPlatformRoute(pathname: string) {
  return (
    pathname.startsWith("/operario") ||
    pathname.startsWith("/tecnico") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/superadmin")
  );
}

/** If this role may not open this path, return the dashboard URL for that role. */
function segmentRoleRedirect(pathname: string, role: string): string | null {
  if (pathname.startsWith("/operario") && role !== "operario") {
    return dashboardMap[role] ?? "/tecnico";
  }
  if (pathname.startsWith("/tecnico") && role !== "agronomo") {
    return dashboardMap[role] ?? "/operario";
  }
  if (pathname.startsWith("/admin") && role !== "admin") {
    return dashboardMap[role] ?? "/superadmin";
  }
  if (pathname.startsWith("/superadmin") && role !== "superadmin") {
    return dashboardMap[role] ?? "/admin";
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              supabaseResponse.headers.set(key, value);
            }
          }
        },
      },
      auth: { debug: false },
    }
  );

  // Use getUser() (same as RSC `getSessionProfile`) — getClaims() can still be "valid" while
  // getUser() fails in dev (cookie refresh / timing), causing /operario ↔ /auth/login 307 loops.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && isStaleSessionAuthError(authError)) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
  }

  const pathname = request.nextUrl.pathname;

  const effectiveUser =
    authError && isStaleSessionAuthError(authError)
      ? null
      : authError || !user
        ? null
        : user;

  let activeRole: string | null = null;
  let mustChangePassword = false;
  if (effectiveUser) {
    const gate = await getSessionGate(supabase, effectiveUser.id);
    activeRole = gate.activeRole;
    mustChangePassword = gate.mustChangePassword;
  }

  if (
    effectiveUser &&
    mustChangePassword &&
    pathname !== CHANGE_PASSWORD_PATH &&
    !pathname.startsWith("/api")
  ) {
    return redirectPreservingAuthCookies(
      request,
      CHANGE_PASSWORD_PATH,
      supabaseResponse
    );
  }

  if (!effectiveUser && !isPublicAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (effectiveUser && isPlatformRoute(pathname) && !activeRole) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
    return redirectPreservingAuthCookies(request, "/auth/login", supabaseResponse);
  }

  if (effectiveUser && activeRole) {
    const wrongSegment = segmentRoleRedirect(pathname, activeRole);
    if (wrongSegment) {
      return redirectPreservingAuthCookies(request, wrongSegment, supabaseResponse);
    }
  }

  if (effectiveUser && pathname === "/") {
    if (!activeRole) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* ignore */
      }
      return redirectPreservingAuthCookies(request, "/auth/login", supabaseResponse);
    }
    if (mustChangePassword) {
      return redirectPreservingAuthCookies(
        request,
        CHANGE_PASSWORD_PATH,
        supabaseResponse
      );
    }
    const dest = dashboardMap[activeRole] ?? "/operario";
    return redirectPreservingAuthCookies(request, dest, supabaseResponse);
  }

  if (effectiveUser && isPublicAuthPath(pathname)) {
    if (!activeRole) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* ignore */
      }
      return supabaseResponse;
    }
    if (mustChangePassword) {
      if (pathname === CHANGE_PASSWORD_PATH) {
        return supabaseResponse;
      }
      return redirectPreservingAuthCookies(
        request,
        CHANGE_PASSWORD_PATH,
        supabaseResponse
      );
    }
    const dest = dashboardMap[activeRole] ?? "/operario";
    return redirectPreservingAuthCookies(request, dest, supabaseResponse);
  }

  return supabaseResponse;
}
