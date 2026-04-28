"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { todayColombiaYmd } from "@/lib/date-colombia";
import {
  actualizarPlanSiembraSchema,
  anularPlanSiembraSchema,
  crearPlanSiembraSchema,
  type ActualizarPlanSiembraInput,
  type CrearPlanSiembraInput,
} from "@/lib/validations/plan-siembra";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

const PLANIFICABLE = ["vacante", "disponible"] as const;

async function fetchMaterialGeneticoValido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<ActionResult<{ nombre: string }>> {
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("nombre, categoria, activo")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return actionError("Material genético no encontrado.");
  if (data.categoria !== "material_genetico" || !data.activo) {
    return actionError("Seleccione un material genético activo del catálogo (RN27).");
  }
  return actionOk({ nombre: data.nombre });
}

function pendienteRequiresConfirm(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const n = Number(value);
  if (Number.isNaN(n)) return false;
  return n > 12;
}

export async function crearPlanSiembra(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearPlanSiembraSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearPlanSiembraInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "agronomo") {
    return actionError("Solo el técnico agrónomo puede planificar siembras.");
  }
  if (session.profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const hoy = todayColombiaYmd();
  if (input.fecha_proyectada < hoy) {
    return actionError("La fecha proyectada no puede ser menor a la fecha actual.");
  }

  const supabase = await createClient();

  const cat = await fetchMaterialGeneticoValido(supabase, input.catalogo_material_id);
  if (!cat.success) return cat;

  const { data: lote, error: le } = await supabase
    .from("lotes")
    .select("id, finca_id, codigo, activo, estado_cultivo, pendiente_pct")
    .eq("id", input.lote_id)
    .maybeSingle();

  if (le || !lote) return actionError("Lote no encontrado.");
  if (lote.finca_id !== input.finca_id) {
    return actionError("El lote no pertenece a la finca.");
  }
  if (!lote.activo) {
    return actionError("El lote no está activo.");
  }
  if (!PLANIFICABLE.includes(lote.estado_cultivo as (typeof PLANIFICABLE)[number])) {
    return actionError(
      "Solo se pueden planificar siembras en lotes en estado vacante o disponible (RN26)."
    );
  }

  if (pendienteRequiresConfirm(lote.pendiente_pct) && !input.confirmacion_erosion) {
    return actionError(
      "Pendiente del terreno mayor al 12%: confirme el riesgo de erosión para continuar (RN28)."
    );
  }

  const { data: inserted, error: insErr } = await supabase
    .from("planes_siembra")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      catalogo_material_id: input.catalogo_material_id,
      fecha_proyectada: input.fecha_proyectada,
      confirmacion_erosion: input.confirmacion_erosion ?? false,
      notas: input.notas ?? null,
      created_by: session.user.id,
      source: "web",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return actionError(insErr?.message ?? "No se pudo crear el plan de siembra.");
  }

  const { error: upLote } = await supabase
    .from("lotes")
    .update({
      estado_cultivo: "planificado_siembra",
      material_genetico: cat.data.nombre,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.lote_id)
    .eq("finca_id", input.finca_id);

  if (upLote) {
    return actionError(upLote.message);
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "plan_siembra.crear",
    titulo: "Plan de siembra registrado",
    detalle: {
      planId: inserted.id,
      loteCodigo: lote.codigo,
      materialGenetico: cat.data.nombre,
      fechaProyectada: input.fecha_proyectada,
      confirmacionErosion: input.confirmacion_erosion ?? false,
    },
  });

  return actionOk({ id: inserted.id });
}

export async function actualizarPlanSiembra(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarPlanSiembraSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ActualizarPlanSiembraInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("Sin permiso para actualizar el plan.");
  }

  const supabase = await createClient();

  const { data: prev, error: pe } = await supabase
    .from("planes_siembra")
    .select("id, finca_id, lote_id, is_voided")
    .eq("id", input.id)
    .maybeSingle();

  if (pe || !prev) return actionError("Plan no encontrado.");
  if (prev.is_voided) return actionError("El plan está anulado.");
  if (
    !isSuperAdmin(session.profile) &&
    session.profile.finca_id !== prev.finca_id
  ) {
    return actionError("No puede editar planes de otra finca.");
  }

  const fincaId = prev.finca_id;

  const hoy = todayColombiaYmd();
  if (input.fecha_proyectada < hoy) {
    return actionError("La fecha proyectada no puede ser menor a la fecha actual.");
  }

  const cat = await fetchMaterialGeneticoValido(supabase, input.catalogo_material_id);
  if (!cat.success) return cat;

  const { data: lote, error: le } = await supabase
    .from("lotes")
    .select("id, finca_id, codigo, activo, estado_cultivo, pendiente_pct")
    .eq("id", prev.lote_id)
    .maybeSingle();

  if (le || !lote) return actionError("Lote no encontrado.");
  if (lote.finca_id !== fincaId) return actionError("El lote no pertenece a la finca.");
  if (!lote.activo) return actionError("El lote no está activo.");
  if (lote.estado_cultivo !== "planificado_siembra") {
    return actionError("El lote ya no está en estado planificado.");
  }

  if (pendienteRequiresConfirm(lote.pendiente_pct) && !input.confirmacion_erosion) {
    return actionError(
      "Pendiente del terreno mayor al 12%: confirme el riesgo de erosión para continuar (RN28)."
    );
  }

  const { data: updated, error: ue } = await supabase
    .from("planes_siembra")
    .update({
      catalogo_material_id: input.catalogo_material_id,
      fecha_proyectada: input.fecha_proyectada,
      confirmacion_erosion: input.confirmacion_erosion ?? false,
      notas: input.notas ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (ue || !updated) {
    return actionError(ue?.message ?? "No se pudo actualizar el plan.");
  }

  await supabase
    .from("lotes")
    .update({
      material_genetico: cat.data.nombre,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prev.lote_id);

  await registrarEventoFinca({
    fincaId,
    actionKey: "plan_siembra.actualizar",
    titulo: "Plan de siembra actualizado",
    detalle: {
      planId: input.id,
      loteCodigo: lote.codigo,
      materialGenetico: cat.data.nombre,
      fechaProyectada: input.fecha_proyectada,
    },
  });

  return actionOk({ id: updated.id });
}

export async function anularPlanSiembra(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = anularPlanSiembraSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("Sin permiso.");
  }

  const supabase = await createClient();

  const { data: row, error: fe } = await supabase
    .from("planes_siembra")
    .select("id, finca_id, lote_id, is_voided")
    .eq("id", id)
    .maybeSingle();

  if (fe || !row) return actionError("Plan no encontrado.");
  if (row.is_voided) return actionError("El plan ya está anulado.");
  if (
    !isSuperAdmin(session.profile) &&
    session.profile.finca_id !== row.finca_id
  ) {
    return actionError("No puede anular planes de otra finca.");
  }

  const { data: voided, error: ve } = await supabase
    .from("planes_siembra")
    .update({ is_voided: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id, lote_id")
    .single();

  if (ve || !voided) {
    return actionError(ve?.message ?? "No se pudo anular.");
  }

  await supabase
    .from("lotes")
    .update({
      estado_cultivo: "disponible",
      updated_at: new Date().toISOString(),
    })
    .eq("id", voided.lote_id)
    .eq("estado_cultivo", "planificado_siembra");

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", voided.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: row.finca_id,
    actionKey: "plan_siembra.anular",
    titulo: "Plan de siembra anulado",
    detalle: {
      planId: voided.id,
      loteCodigo: lote?.codigo ?? voided.lote_id,
    },
  });

  return actionOk({ id: voided.id });
}
