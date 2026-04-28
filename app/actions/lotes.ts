"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getSessionProfile,
  canManageLotes,
} from "@/lib/auth/session-profile";
import {
  crearLoteSchema,
  actualizarLoteSchema,
  type CrearLoteInput,
  type ActualizarLoteInput,
} from "@/lib/validations/finca-lote";
import { actionError, actionOk, type ActionResult } from "./types";

export async function crearLote(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = crearLoteSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearLoteInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile || !canManageLotes(session.profile)) {
    return actionError("No tiene permiso para crear lotes.");
  }

  const { profile } = session;
  if (profile.role === "admin" || profile.role === "agronomo") {
    if (!profile.finca_id || profile.finca_id !== input.finca_id) {
      return actionError("Solo puede crear lotes en su finca asignada.");
    }
  }

  const supabase = await createClient();

  // RN11: Validate that lote area doesn't exceed remaining finca capacity
  const { data: finca } = await supabase
    .from("fincas")
    .select("area_ha")
    .eq("id", input.finca_id)
    .maybeSingle();

  if (finca) {
    const { data: existingLotes } = await supabase
      .from("lotes")
      .select("area_ha")
      .eq("finca_id", input.finca_id);
    const usedArea = (existingLotes ?? []).reduce(
      (sum, l) => sum + Number(l.area_ha ?? 0),
      0
    );
    const totalFincaArea = Number(finca.area_ha ?? 0);
    if (usedArea + input.area_ha > totalFincaArea) {
      const remaining = (totalFincaArea - usedArea).toFixed(4);
      return actionError(
        `El área del lote supera la capacidad disponible de la finca. Disponible: ${remaining} ha.`
      );
    }
  }

  const { data, error } = await supabase
    .from("lotes")
    .insert({
      finca_id: input.finca_id,
      codigo: input.codigo.trim(),
      area_ha: input.area_ha,
      anio_siembra: input.anio_siembra,
      material_genetico: input.material_genetico?.trim() || null,
      densidad_palmas_ha: input.densidad_palmas_ha ?? null,
      pendiente_pct: input.pendiente_pct ?? null,
      ...(input.estado_cultivo ? { estado_cultivo: input.estado_cultivo } : {}),
    })
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  return actionOk({ id: data.id });
}

export async function actualizarLote(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarLoteSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ActualizarLoteInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile || !canManageLotes(session.profile)) {
    return actionError("No tiene permiso para editar lotes.");
  }

  const { profile } = session;
  if (profile.role === "admin" || profile.role === "agronomo") {
    if (!profile.finca_id || profile.finca_id !== input.finca_id) {
      return actionError("Solo puede editar lotes de su finca asignada.");
    }
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("lotes")
    .select("id, finca_id")
    .eq("id", input.id)
    .maybeSingle();

  if (!existing || existing.finca_id !== input.finca_id) {
    return actionError("El lote no coincide con la finca indicada.");
  }

  const { data, error } = await supabase
    .from("lotes")
    .update({
      codigo: input.codigo.trim(),
      area_ha: input.area_ha,
      anio_siembra: input.anio_siembra,
      material_genetico: input.material_genetico?.trim() || null,
      densidad_palmas_ha: input.densidad_palmas_ha ?? null,
      pendiente_pct: input.pendiente_pct ?? null,
      ...(input.estado_cultivo !== undefined
        ? { estado_cultivo: input.estado_cultivo }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  return actionOk({ id: data.id });
}
