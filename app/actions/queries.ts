"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionResult } from "./types";

export type LoteOption = { id: string; codigo: string };

export async function getLotesPorFinca(
  fincaId: string
): Promise<ActionResult<LoteOption[]>> {
  const id = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lotes")
    .select("id, codigo")
    .eq("finca_id", id)
    .order("codigo");

  if (error) {
    return actionError(error.message);
  }

  return actionOk(data ?? []);
}

export type CatalogoFitosanidadOption = {
  id: string;
  nombre: string;
  categoria: string;
};

export async function getCatalogoFitosanidad(): Promise<
  ActionResult<CatalogoFitosanidadOption[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre, categoria")
    .eq("activo", true)
    .in("categoria", ["plaga", "enfermedad"])
    .order("categoria")
    .order("nombre");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as CatalogoFitosanidadOption[]);
}
