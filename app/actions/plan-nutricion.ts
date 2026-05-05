"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { isInsumoNutricion } from "@/lib/catalogo-insumo-fitosanitario";
import {
  actualizarPlanNutricionSchema,
  anularPlanNutricionSchema,
  crearPlanNutricionSchema,
  type ActualizarPlanNutricionInput,
  type CrearPlanNutricionInput,
} from "@/lib/validations/plan-nutricion";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

async function fetchInsumoNutricionValido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<ActionResult<{ nombre: string }>> {
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre, categoria, subcategoria, activo")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return actionError("Insumo no encontrado.");
  if (data.categoria !== "insumo" || !data.activo) {
    return actionError("Seleccione un insumo activo del cat?logo.");
  }
  if (!isInsumoNutricion(data.subcategoria)) {
    return actionError(
      "Solo insumos de nutrici?n/fertilizaci?n. Revise la subcategor?a en el cat?logo."
    );
  }
  return actionOk({ nombre: data.nombre });
}

function canMutatePlanNutricion(profile: {
  role: string;
  is_active: boolean | null;
  finca_id: string | null;
} | null): boolean {
  if (!profile?.is_active) return false;
  return profile.role === "agronomo" || profile.role === "superadmin";
}

async function voidPlanIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string
): Promise<void> {
  await supabase
    .from("planes_nutricion")
    .update({ is_voided: true, updated_at: new Date().toISOString() })
    .eq("id", planId);
}

export async function crearPlanNutricion(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearPlanNutricionSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearPlanNutricionInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "agronomo") {
    return actionError("Solo el técnico agrónomo puede crear planes de nutrición y riego.");
  }
  if (session.profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  if (input.fecha_inicio && input.fecha_fin && input.fecha_fin < input.fecha_inicio) {
    return actionError("La fecha fin no puede ser anterior a la fecha inicio.");
  }

  const supabase = await createClient();

  for (const it of input.items) {
    const v = await fetchInsumoNutricionValido(supabase, it.catalogo_insumo_id);
    if (!v.success) return v;
  }

  const { data: lote, error: le } = await supabase
    .from("lotes")
    .select("id, finca_id, codigo, activo")
    .eq("id", input.lote_id)
    .maybeSingle();

  if (le || !lote) return actionError("Lote no encontrado.");
  if (lote.finca_id !== input.finca_id) {
    return actionError("El lote no pertenece a la finca.");
  }
  if (!lote.activo) {
    return actionError("El lote no está activo.");
  }

  const { data: inserted, error: insErr } = await supabase
    .from("planes_nutricion")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      nombre: input.nombre?.trim() ?? null,
      fecha_inicio: input.fecha_inicio ?? null,
      fecha_fin: input.fecha_fin ?? null,
      notas: input.notas?.trim() ?? null,
      created_by: session.user.id,
      source: "web",
      is_voided: false,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return actionError(insErr?.message ?? "No se pudo crear el plan.");
  }

  const planId = inserted.id;

  if (input.items.length > 0) {
    const rows = input.items.map((it) => ({
      plan_id: planId,
      catalogo_insumo_id: it.catalogo_insumo_id,
      dosis_cantidad: it.dosis_cantidad,
      dosis_unidad: it.dosis_unidad,
      frecuencia: it.frecuencia,
      fecha_objetivo: it.fecha_objetivo ?? null,
      notas: it.notas?.trim() ?? null,
    }));
    const { error: ie } = await supabase.from("planes_nutricion_items").insert(rows);
    if (ie) {
      await voidPlanIfNeeded(supabase, planId);
      return actionError(ie.message);
    }
  }

  if (input.riego.length > 0) {
    const rrows = input.riego.map((r) => ({
      plan_id: planId,
      descripcion: r.descripcion.trim(),
      intervalo_dias: r.intervalo_dias ?? null,
      proxima_fecha: r.proxima_fecha,
      volumen_o_tiempo: r.volumen_o_tiempo?.trim() ?? null,
      notas: r.notas?.trim() ?? null,
    }));
    const { error: re } = await supabase.from("planes_riego_items").insert(rrows);
    if (re) {
      await supabase.from("planes_nutricion_items").delete().eq("plan_id", planId);
      await voidPlanIfNeeded(supabase, planId);
      return actionError(re.message);
    }
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "nutricion.plan_crear",
    titulo: "Plan de nutrición y riego creado",
    detalle: {
      planId,
      loteCodigo: lote.codigo,
      lineasNutricion: input.items.length,
      lineasRiego: input.riego.length,
    },
  });

  return actionOk({ id: planId });
}

export async function actualizarPlanNutricion(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarPlanNutricionSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ActualizarPlanNutricionInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (!canMutatePlanNutricion(session.profile)) {
    return actionError("Sin permiso para actualizar el plan.");
  }

  if (input.fecha_inicio && input.fecha_fin && input.fecha_fin < input.fecha_inicio) {
    return actionError("La fecha fin no puede ser anterior a la fecha inicio.");
  }

  const supabase = await createClient();

  const { data: prev, error: pe } = await supabase
    .from("planes_nutricion")
    .select("id, finca_id, lote_id, is_voided, locked_at")
    .eq("id", input.id)
    .maybeSingle();

  if (pe || !prev) return actionError("Plan no encontrado.");
  if (prev.is_voided) return actionError("El plan está anulado.");
  if (prev.locked_at) {
    return actionError("El plan está bloqueado (aplicación registrada). No se puede editar.");
  }
  if (
    !isSuperAdmin(session.profile) &&
    session.profile.finca_id !== prev.finca_id
  ) {
    return actionError("No puede editar planes de otra finca.");
  }

  if (input.finca_id !== prev.finca_id) {
    return actionError("La finca del formulario no coincide con el plan.");
  }
  if (input.lote_id !== prev.lote_id) {
    return actionError("No se permite cambiar el lote del plan. Anule y cree uno nuevo.");
  }

  for (const it of input.items) {
    const v = await fetchInsumoNutricionValido(supabase, it.catalogo_insumo_id);
    if (!v.success) return v;
  }

  const { data: lote, error: le } = await supabase
    .from("lotes")
    .select("id, finca_id, codigo, activo")
    .eq("id", prev.lote_id)
    .maybeSingle();

  if (le || !lote) return actionError("Lote no encontrado.");
  if (!lote.activo) return actionError("El lote no está activo.");

  const { error: delN } = await supabase
    .from("planes_nutricion_items")
    .delete()
    .eq("plan_id", input.id);
  if (delN) return actionError(delN.message);

  const { error: delR } = await supabase
    .from("planes_riego_items")
    .delete()
    .eq("plan_id", input.id);
  if (delR) return actionError(delR.message);

  if (input.items.length > 0) {
    const rows = input.items.map((it) => ({
      plan_id: input.id,
      catalogo_insumo_id: it.catalogo_insumo_id,
      dosis_cantidad: it.dosis_cantidad,
      dosis_unidad: it.dosis_unidad,
      frecuencia: it.frecuencia,
      fecha_objetivo: it.fecha_objetivo ?? null,
      notas: it.notas?.trim() ?? null,
    }));
    const { error: ie } = await supabase.from("planes_nutricion_items").insert(rows);
    if (ie) return actionError(ie.message);
  }

  if (input.riego.length > 0) {
    const rrows = input.riego.map((r) => ({
      plan_id: input.id,
      descripcion: r.descripcion.trim(),
      intervalo_dias: r.intervalo_dias ?? null,
      proxima_fecha: r.proxima_fecha,
      volumen_o_tiempo: r.volumen_o_tiempo?.trim() ?? null,
      notas: r.notas?.trim() ?? null,
    }));
    const { error: re } = await supabase.from("planes_riego_items").insert(rrows);
    if (re) return actionError(re.message);
  }

  const { data: updated, error: ue } = await supabase
    .from("planes_nutricion")
    .update({
      nombre: input.nombre?.trim() ?? null,
      fecha_inicio: input.fecha_inicio ?? null,
      fecha_fin: input.fecha_fin ?? null,
      notas: input.notas?.trim() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (ue || !updated) {
    return actionError(ue?.message ?? "No se pudo actualizar el plan.");
  }

  await registrarEventoFinca({
    fincaId: prev.finca_id,
    actionKey: "nutricion.plan_actualizar",
    titulo: "Plan de nutrición y riego actualizado",
    detalle: {
      planId: input.id,
      loteCodigo: lote.codigo,
      lineasNutricion: input.items.length,
      lineasRiego: input.riego.length,
    },
  });

  return actionOk({ id: updated.id });
}

export async function anularPlanNutricion(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = anularPlanNutricionSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  if (!canMutatePlanNutricion(session.profile)) {
    return actionError("Sin permiso.");
  }

  const supabase = await createClient();

  const { data: row, error: fe } = await supabase
    .from("planes_nutricion")
    .select("id, finca_id, lote_id, is_voided, locked_at")
    .eq("id", id)
    .maybeSingle();

  if (fe || !row) return actionError("Plan no encontrado.");
  if (row.is_voided) return actionError("El plan ya está anulado.");
  if (row.locked_at) {
    return actionError("No se puede anular un plan bloqueado por aplicación en campo.");
  }
  if (
    !isSuperAdmin(session.profile) &&
    session.profile.finca_id !== row.finca_id
  ) {
    return actionError("No puede anular planes de otra finca.");
  }

  const { data: voided, error: ve } = await supabase
    .from("planes_nutricion")
    .update({ is_voided: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (ve || !voided) {
    return actionError(ve?.message ?? "No se pudo anular.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", row.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: row.finca_id,
    actionKey: "nutricion.plan_anular",
    titulo: "Plan de nutrición y riego anulado",
    detalle: {
      planId: voided.id,
      loteCodigo: lote?.codigo ?? row.lote_id,
    },
  });

  return actionOk({ id: voided.id });
}
