/** Reglas de acceso a rutas por rol (usadas por el proxy y cubiertas por pruebas). Sin dependencias. */

export const ROLES = ["superadmin", "admin", "agronomo", "operario"] as const;
export type RolUsuario = (typeof ROLES)[number];

export const DASHBOARD_POR_ROL: Record<RolUsuario, string> = {
  superadmin: "/superadmin",
  admin: "/admin",
  agronomo: "/tecnico",
  operario: "/operario",
};

export function isPublicAuthPath(pathname: string) {
  return pathname.startsWith("/auth") || pathname === "/login";
}

export function isPlatformRoute(pathname: string) {
  return (
    pathname.startsWith("/operario") ||
    pathname.startsWith("/tecnico") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/superadmin")
  );
}

/** Si este rol no puede abrir la ruta, devuelve el panel de ese rol; si puede, null. */
export function segmentRoleRedirect(pathname: string, role: string): string | null {
  const panel = (porDefecto: string) => DASHBOARD_POR_ROL[role as RolUsuario] ?? porDefecto;
  if (pathname.startsWith("/operario") && role !== "operario") return panel("/tecnico");
  if (pathname.startsWith("/tecnico") && role !== "agronomo") return panel("/operario");
  if (pathname.startsWith("/admin") && role !== "admin") return panel("/superadmin");
  if (pathname.startsWith("/superadmin") && role !== "superadmin") return panel("/admin");
  return null;
}
