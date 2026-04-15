"use server";

import { createClient } from "@/lib/supabase/server";
import {
  registrarLaborSchema,
  type RegistrarLaborInput,
} from "@/lib/validations/operativo";
import { actionError, actionOk, type ActionResult } from "./types";

export async function registrarLabor(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarLaborSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarLaborInput = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }

  const { data, error } = await supabase
    .from("labores_agronomicas")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      tipo: input.tipo,
      fecha_ejecucion: input.fecha_ejecucion,
      notas: input.notas ?? null,
      created_by: user.id,
      source: input.source,
    })
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  return actionOk({ id: data.id });
}
