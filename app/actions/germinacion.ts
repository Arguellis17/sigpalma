"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  actualizarRegistroGerminacionSchema,
  crearRegistroGerminacionSchema,
  type ActualizarRegistroGerminacionInput,
  type CrearRegistroGerminacionInput,
} from "@/lib/validations/germinacion";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

async function assertMaterialGeneticoFinca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fincaId: string,
  catalogoMaterialId: string,
  loteId: string | null | undefined
): Promise<ActionResult<void>> {
  const { data: cat, error: ce } = await supabase
    .from("catalogo_items")
    .select("id, categoria, activo, proveedor")
    .eq("id", catalogoMaterialId)
    .maybeSingle();
  if (ce || !cat) return actionError("Material genético no encontrado.");
  if (cat.categoria !== "material_genetico" || !cat.activo) {
    return actionError("Seleccione material genético activo del catálogo.");
  }
  if (!cat.proveedor?.trim()) {
    return actionError(
      "El material genético debe tener proveedor certificado (RN16)."
    );
  }

  if (loteId) {
    const { data: lote, error: le } = await supabase
      .from("lotes")
      .select("id, finca_id")
      .eq("id", loteId)
      .maybeSingle();
    if (le || !lote) return actionError("Lote no encontrado.");
    if (lote.finca_id !== fincaId) {
      return actionError("El lote no pertenece a la finca.");
    }
  }

  return actionOk(undefined);
}

export async function crearRegistroGerminacion(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearRegistroGerminacionSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearRegistroGerminacionInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  const role = session.profile.role;
  if (role !== "operario" && role !== "agronomo") {
    return actionError("Solo operario o técnico agrónomo puede registrar germinación.");
  }
  if (session.profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();
  const mat = await assertMaterialGeneticoFinca(
    supabase,
    input.finca_id,
    input.catalogo_material_id,
    input.lote_id
  );
  if (!mat.success) return mat;

  const { data: inserted, error: insErr } = await supabase
    .from("registros_germinacion")
    .insert({
      finca_id: input.finca_id,
      catalogo_material_id: input.catalogo_material_id,
      lote_id: input.lote_id ?? null,
      fecha_tratamiento: input.fecha_tratamiento,
      temperatura_max_c: input.temperatura_max_c,
      dias_tratamiento: input.dias_tratamiento,
      notas: input.notas?.trim() ?? null,
      created_by: session.user.id,
      source: "web",
      is_voided: false,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return actionError(insErr?.message ?? "No se pudo registrar la germinación.");
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "vivero.germinacion_crear",
    titulo: "Registro de germinación / tratamiento térmico",
    detalle: {
      germinacionId: inserted.id,
      catalogoMaterialId: input.catalogo_material_id,
      fechaTratamiento: input.fecha_tratamiento,
    },
  });

  return actionOk({ id: inserted.id });
}

export async function actualizarRegistroGerminacion(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarRegistroGerminacionSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ActualizarRegistroGerminacionInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  const role = session.profile.role;
  if (role !== "operario" && role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("Sin permiso.");
  }

  const supabase = await createClient();

  const { data: prev, error: pe } = await supabase
    .from("registros_germinacion")
    .select("id, finca_id, created_by, is_voided")
    .eq("id", input.id)
    .maybeSingle();

  if (pe || !prev) return actionError("Registro no encontrado.");
  if (prev.is_voided) return actionError("El registro está anulado.");
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== prev.finca_id) {
    return actionError("No puede editar registros de otra finca.");
  }
  if (role === "operario" && prev.created_by !== session.user.id) {
    return actionError("Solo puede editar sus propios registros de germinación.");
  }

  if (input.finca_id !== prev.finca_id) {
    return actionError("No se permite cambiar la finca del registro.");
  }

  const mat = await assertMaterialGeneticoFinca(
    supabase,
    input.finca_id,
    input.catalogo_material_id,
    input.lote_id
  );
  if (!mat.success) return mat;

  const { data: updated, error: ue } = await supabase
    .from("registros_germinacion")
    .update({
      catalogo_material_id: input.catalogo_material_id,
      lote_id: input.lote_id ?? null,
      fecha_tratamiento: input.fecha_tratamiento,
      temperatura_max_c: input.temperatura_max_c,
      dias_tratamiento: input.dias_tratamiento,
      notas: input.notas?.trim() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id")
    .single();

  if (ue || !updated) {
    return actionError(ue?.message ?? "No se pudo actualizar.");
  }

  await registrarEventoFinca({
    fincaId: prev.finca_id,
    actionKey: "vivero.germinacion_actualizar",
    titulo: "Germinación actualizada",
    detalle: { germinacionId: input.id },
  });

  return actionOk({ id: updated.id });
}
