import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export type UserRole = Enums<"user_role">;

export type SessionProfile = {
  user: User;
  profile: Tables<"profiles"> | null;
};

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}

/** Returns true for superadmin only. */
export function isSuperAdmin(profile: Tables<"profiles"> | null): boolean {
  return profile?.role === "superadmin" && profile.is_active === true;
}

/** Returns true for admin OR superadmin. */
export function isAdmin(profile: Tables<"profiles"> | null): boolean {
  return (
    (profile?.role === "admin" || profile?.role === "superadmin") &&
    profile.is_active === true
  );
}

/** Returns true if user's role is in the allowed list and account is active. */
export function hasRole(
  profile: Tables<"profiles"> | null,
  allowedRoles: UserRole[]
): boolean {
  if (!profile?.is_active) return false;
  return allowedRoles.includes(profile.role);
}

/** Returns the default dashboard path for a given role. */
export function getRoleDashboardPath(role: UserRole | null | undefined): string {
  switch (role) {
    case "superadmin": return "/superadmin";
    case "admin":      return "/admin";
    case "agronomo":   return "/tecnico";
    case "operario":   return "/operario";
    default:           return "/auth/login";
  }
}

export function canManageLotes(profile: Tables<"profiles"> | null): boolean {
  if (!profile?.is_active) return false;
  return hasRole(profile, ["superadmin", "admin", "agronomo"]);
}

/** Labores, cosecha y alertas: RLS solo permite insertar a no-admin con finca asignada. */
export function canRecordCampoOperations(
  profile: Tables<"profiles"> | null
): boolean {
  if (!profile?.is_active || !profile.finca_id) return false;
  if (profile.role === "admin" || profile.role === "superadmin") return false;
  return profile.role === "operario" || profile.role === "agronomo";
}

/**
 * Server-side route guard. Call from layout.tsx.
 * Redirects to the appropriate destination if the user doesn't have the required role.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  redirectPath?: string
): Promise<SessionProfile> {
  const session = await getSessionProfile();

  if (!session) {
    redirect("/auth/login");
  }

  if (!hasRole(session.profile, allowedRoles)) {
    redirect(redirectPath ?? getRoleDashboardPath(session.profile?.role));
  }

  return session;
}
