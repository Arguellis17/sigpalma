import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

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

export function isAdmin(profile: Tables<"profiles"> | null): boolean {
  return profile?.role === "admin" && profile.is_active === true;
}

export function canManageLotes(profile: Tables<"profiles"> | null): boolean {
  if (!profile?.is_active) return false;
  return profile.role === "admin" || profile.role === "agronomo";
}

/** Labores, cosecha y alertas: RLS solo permite insertar a no-admin con finca asignada. */
export function canRecordCampoOperations(
  profile: Tables<"profiles"> | null
): boolean {
  if (!profile?.is_active || !profile.finca_id) return false;
  if (profile.role === "admin") return false;
  return profile.role === "operario" || profile.role === "agronomo";
}
