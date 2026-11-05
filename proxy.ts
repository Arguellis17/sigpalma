import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // PWA: el service worker (/serwist/*), la página sin conexión y el manifiesto deben cargarse
    // sin sesión ni redirecciones (el navegador rechaza un service worker redirigido).
    // api/v1/ping: comprobación de conectividad cada 30 s, sin consultar la sesión.
    "/((?!_next/static|_next/image|favicon.ico|serwist/|~offline|manifest\\.webmanifest|api/v1/ping|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
