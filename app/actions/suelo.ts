"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  registrarAnalisisSueloSchema,
  type RegistrarAnalisisSueloInput,
} from "@/lib/validations/suelo";
import { actionError, actionOk, type ActionResult } from "./types";
import type { Database } from "@/lib/database.types";

type AnalisisSueloRow = Database["public"]["Tables"]["analisis_suelo"]["Row"];

// ─── HU16: Registrar análisis de suelo ───────────────────────────────────────

export async function registrarAnalisisSuelo(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarAnalisisSueloSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarAnalisisSueloInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile) {
    return actionError("Sesión no encontrada.");
  }

  const allowedRoles: string[] = ["superadmin", "admin", "agronomo"];
  if (!allowedRoles.includes(session.profile.role ?? "")) {
    return actionError("No tienes permiso para registrar análisis de suelo.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("analisis_suelo")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha_analisis: input.fecha_analisis,
      ph: input.ph ?? null,
      humedad_pct: input.humedad_pct ?? null,
      compactacion: input.compactacion !== null && input.compactacion !== undefined
        ? String(input.compactacion)
        : null,
      nutrientes: input.nutrientes ?? null,
      notas: input.notas?.trim() ?? null,
      archivo_url: input.archivo_url ?? null,
      created_by: session.user.id,
      source: "web",
      is_voided: false,
    })
    .select("id")
    .single();

  if (error || !data) return actionError(error?.message ?? "No se pudo registrar el análisis.");
  return actionOk({ id: data.id });
}

// ─── HU16: Listar análisis por lote / finca ──────────────────────────────────

export async function listarAnalisisPorFinca(
  fincaId: string,
  loteId?: string
): Promise<ActionResult<AnalisisSueloRow[]>> {
  if (!fincaId) return actionError("Indique la finca.");

  const session = await getSessionProfile();
  if (!session?.profile) return actionError("Sesión no encontrada.");

  const allowedRoles: string[] = ["superadmin", "admin", "agronomo"];
  if (!allowedRoles.includes(session.profile.role ?? "")) {
    return actionError("No tienes permiso para ver análisis de suelo.");
  }

  const supabase = await createClient();

  let query = supabase
    .from("analisis_suelo")
    .select("*")
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("created_at", { ascending: false });

  if (loteId) {
    query = query.eq("lote_id", loteId);
  }

  const { data, error } = await query;
  if (error) return actionError(error.message);
  return actionOk(data ?? []);
}
