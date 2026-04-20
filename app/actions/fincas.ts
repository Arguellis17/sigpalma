"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  crearFincaSchema,
  actualizarFincaSchema,
  type CrearFincaInput,
  type ActualizarFincaInput,
} from "@/lib/validations/finca-lote";
import { actionError, actionOk, type ActionResult } from "./types";

export async function crearFinca(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = crearFincaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearFincaInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile || !isSuperAdmin(session.profile)) {
    return actionError("Solo el superadministrador puede crear fincas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fincas")
    .insert({
      nombre: input.nombre.trim(),
      ubicacion: input.ubicacion?.trim() || null,
      area_ha: input.area_ha,
      propietario: input.propietario?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  return actionOk({ id: data.id });
}

export async function actualizarFinca(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarFincaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ActualizarFincaInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile || !isSuperAdmin(session.profile)) {
    return actionError("Solo el superadministrador puede editar fincas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fincas")
    .update({
      nombre: input.nombre.trim(),
      ubicacion: input.ubicacion?.trim() || null,
      area_ha: input.area_ha,
      propietario: input.propietario?.trim() || null,
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
