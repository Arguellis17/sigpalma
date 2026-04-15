"use server";

import { createClient } from "@/lib/supabase/server";
import {
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
