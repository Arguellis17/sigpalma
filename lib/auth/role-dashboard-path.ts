import type { Enums } from "@/lib/database.types";

/** Ruta por defecto del panel según rol (misma lógica que `session-profile`, sin imports de servidor). */
export function getRoleDashboardPath(
  role: Enums<"user_role"> | null | undefined
): string {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    case "admin":
      return "/admin";
    case "agronomo":
      return "/tecnico";
    case "operario":
      return "/operario";
    default:
      return "/auth/login";
  }
}
