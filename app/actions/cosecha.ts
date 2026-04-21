"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  anularRegistroCampoSchema,
  reportarCosechaSchema,
  type ReportarCosechaInput,
} from "@/lib/validations/operativo";
import { actionError, actionOk, type ActionResult } from "./types";

export type ReportarCosechaResult = {
  id: string;
  rendimiento_ton_ha: number;
};

export async function reportarCosecha(
  raw: unknown
): Promise<ActionResult<ReportarCosechaResult>> {
  const parsed = reportarCosechaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ReportarCosechaInput = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }

  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select("id, area_ha")
    .eq("id", input.lote_id)
    .eq("finca_id", input.finca_id)
    .maybeSingle();

  if (loteErr) {
    return actionError(loteErr.message);
  }
  if (!lote) {
    return actionError("Lote no encontrado para la finca indicada.");
  }

  const areaHa = Number(lote.area_ha);
  if (!Number.isFinite(areaHa) || areaHa <= 0) {
    return actionError("El área del lote no es válida para calcular rendimiento.");
  }

  const { data, error } = await supabase
    .from("cosechas_rff")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha: input.fecha,
      peso_kg: input.peso_kg,
      conteo_racimos: input.conteo_racimos,
      madurez_frutos_caidos_min: input.madurez_frutos_caidos_min ?? null,
      madurez_frutos_caidos_max: input.madurez_frutos_caidos_max ?? null,
      observaciones_calidad: input.observaciones_calidad ?? null,
      created_by: user.id,
      source: input.source,
    })
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  const pesoT = input.peso_kg / 1000;
  const rendimiento_ton_ha = pesoT / areaHa;

  return actionOk({
    id: data.id,
    rendimiento_ton_ha,
  });
}

export async function anularCosecha(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = anularRegistroCampoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no encontrada.");
  }
  const { profile } = session;
  const role = profile.role;
  if (
    role !== "operario" &&
    role !== "agronomo" &&
    !isSuperAdmin(profile)
  ) {
    return actionError("No tienes permiso para anular cosechas.");
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("cosechas_rff")
    .select("id, finca_id, is_voided")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return actionError(fetchErr?.message ?? "Cosecha no encontrada.");
  }
  if (row.is_voided) {
    return actionError("Este registro ya está anulado.");
  }
  if (!isSuperAdmin(profile) && profile.finca_id !== row.finca_id) {
    return actionError("No puede anular registros de otra finca.");
  }

  const { data, error } = await supabase
    .from("cosechas_rff")
    .update({ is_voided: true })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(error?.message ?? "No se pudo anular el registro.");
  }
  return actionOk({ id: data.id });
}
