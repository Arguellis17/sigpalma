"use server";

import { createClient } from "@/lib/supabase/server";
import {
  alertaFitosanitariaSchema,
  type AlertaFitosanitariaInput,
} from "@/lib/validations/operativo";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export async function crearAlertaFitosanitaria(
  raw: unknown
): Promise<ActionResult<{ id: string; lote_estado_alerta: boolean }>> {
  const parsed = alertaFitosanitariaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: AlertaFitosanitariaInput = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }

  const lote_estado_alerta = input.severidad === "critica";

  const { data, error } = await supabase
    .from("alertas_fitosanitarias")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      catalogo_item_id: input.catalogo_item_id ?? null,
      severidad: input.severidad,
      descripcion: input.descripcion ?? null,
      lote_estado_alerta,
      created_by: user.id,
      source: input.source,
    })
    .select("id, lote_estado_alerta")
    .single();

  if (error) {
    return actionError(error.message);
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", input.lote_id)
    .maybeSingle();

  let amenazaNombre: string | null = null;
  if (input.catalogo_item_id) {
    const { data: cat } = await supabase
      .from("catalogo_items")
      .select("nombre")
      .eq("id", input.catalogo_item_id)
      .maybeSingle();
    amenazaNombre = cat?.nombre ?? null;
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "alerta.crear",
    titulo: "Reporte fitosanitario en campo",
    detalle: {
      alertaId: data.id,
      loteCodigo: lote?.codigo ?? input.lote_id,
      severidad: input.severidad,
      amenaza: amenazaNombre,
      descripcion: input.descripcion ?? null,
      loteEnEstadoAlerta: data.lote_estado_alerta,
    },
  });

  return actionOk({
    id: data.id,
    lote_estado_alerta: data.lote_estado_alerta,
  });
}
