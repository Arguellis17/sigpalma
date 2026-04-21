"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  anularRegistroCampoSchema,
  registrarLaborSchema,
  type RegistrarLaborInput,
} from "@/lib/validations/operativo";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

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

  const { data: loteRow } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", input.lote_id)
    .eq("finca_id", input.finca_id)
    .maybeSingle();

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

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "labor.registrar",
    titulo: "Registro de labor agronómica",
    detalle: {
      registroId: data.id,
      loteCodigo: loteRow?.codigo ?? input.lote_id,
      tipoLabor: input.tipo,
      fechaEjecucion: input.fecha_ejecucion,
      notas: input.notas ?? null,
    },
  });

  return actionOk({ id: data.id });
}

export async function anularLabor(
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
    return actionError("No tienes permiso para anular labores.");
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("labores_agronomicas")
    .select("id, finca_id, is_voided")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return actionError(fetchErr?.message ?? "Labor no encontrada.");
  }
  if (row.is_voided) {
    return actionError("Esta labor ya está anulada.");
  }
  if (!isSuperAdmin(profile) && profile.finca_id !== row.finca_id) {
    return actionError("No puede anular registros de otra finca.");
  }

  const { data, error } = await supabase
    .from("labores_agronomicas")
    .update({ is_voided: true })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id, finca_id, lote_id, tipo, fecha_ejecucion")
    .single();

  if (error || !data) {
    return actionError(error?.message ?? "No se pudo anular la labor.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", data.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: data.finca_id,
    actionKey: "labor.anular",
    titulo: "Anulación de labor agronómica",
    detalle: {
      registroId: data.id,
      loteCodigo: lote?.codigo ?? data.lote_id,
      tipoLabor: data.tipo,
      fechaEjecucion: data.fecha_ejecucion,
    },
  });

  return actionOk({ id: data.id });
}
