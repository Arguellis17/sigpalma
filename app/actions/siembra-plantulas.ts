"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getSessionProfile,
  hasRole,
} from "@/lib/auth/session-profile";
import { assertCadenaViveroAptoParaPlanSiembra } from "@/lib/vivero-gate";
import { validarCantidadPalmasSiembra } from "@/lib/siembra-plantulas";
import {
  registrarSiembraPlantulasSchema,
  type RegistrarSiembraPlantulasInput,
} from "@/lib/validations/siembra-plantulas";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export async function registrarSiembraPlantulas(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarSiembraPlantulasSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarSiembraPlantulasInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user) {
    return actionError("Sesión no válida.");
  }
  const profile = session.profile;
  if (!hasRole(profile, ["operario", "agronomo", "superadmin"])) {
    return actionError("No tiene permiso para registrar siembra.");
  }
  if (
    profile?.role !== "superadmin" &&
    profile?.finca_id &&
    profile.finca_id !== input.finca_id
  ) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();

  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select(
      "id, codigo, finca_id, activo, estado_cultivo, area_ha, densidad_palmas_ha, anio_siembra"
    )
    .eq("id", input.lote_id)
    .maybeSingle();

  if (loteErr || !lote) {
    return actionError("Lote no encontrado.");
  }
  if (lote.finca_id !== input.finca_id) {
    return actionError("El lote no pertenece a la finca.");
  }
  if (!lote.activo) {
    return actionError("El lote no está activo.");
  }
  if (lote.estado_cultivo !== "listo_para_siembra") {
    return actionError(
      "El lote debe estar listo para siembra. Complete la preparación de terreno antes de sembrar."
    );
  }

  const { data: prep, error: prepErr } = await supabase
    .from("preparaciones_terreno")
    .select("id, finca_id, lote_id, plan_siembra_id, estado, is_voided")
    .eq("id", input.preparacion_terreno_id)
    .maybeSingle();

  if (prepErr || !prep) {
    return actionError("Preparación de terreno no encontrada.");
  }
  if (prep.is_voided || prep.estado !== "aprobado") {
    return actionError(
      "Debe existir una preparación de terreno aprobada antes de registrar la siembra."
    );
  }
  if (prep.lote_id !== input.lote_id || prep.finca_id !== input.finca_id) {
    return actionError("La preparación no corresponde al lote seleccionado.");
  }

  const { data: plan, error: planErr } = await supabase
    .from("planes_siembra")
    .select("id, finca_id, lote_id, catalogo_material_id, is_voided")
    .eq("id", input.plan_siembra_id)
    .maybeSingle();

  if (planErr || !plan) {
    return actionError("Plan de siembra no encontrado.");
  }
  if (plan.is_voided || plan.lote_id !== input.lote_id) {
    return actionError("El plan de siembra no corresponde al lote.");
  }
  if (plan.id !== prep.plan_siembra_id) {
    return actionError("El plan de siembra no coincide con la preparación del lote.");
  }

  const viveroGate = await assertCadenaViveroAptoParaPlanSiembra(
    supabase,
    input.finca_id,
    plan.catalogo_material_id
  );
  if (!viveroGate.success) return viveroGate;

  const { data: material, error: matErr } = await supabase
    .from("catalogo_items")
    .select("id, nombre, categoria, activo")
    .eq("id", plan.catalogo_material_id)
    .maybeSingle();

  if (matErr || !material) {
    return actionError("Material genético del plan no encontrado.");
  }
  if (material.categoria !== "material_genetico" || !material.activo) {
    return actionError("El material genético del plan no es válido.");
  }

  const rn58 = validarCantidadPalmasSiembra(input.cantidad_palmas, {
    area_ha: lote.area_ha,
    densidad_palmas_ha: lote.densidad_palmas_ha,
  });
  if (rn58) return actionError(rn58);

  const { data: existente } = await supabase
    .from("registros_siembra")
    .select("id")
    .eq("lote_id", input.lote_id)
    .eq("is_voided", false)
    .maybeSingle();

  if (existente) {
    return actionError("Este lote ya tiene un registro de siembra activo.");
  }

  const anioSiembra = Number(input.fecha_siembra.slice(0, 4));

  const { data: row, error: insertErr } = await supabase
    .from("registros_siembra")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      plan_siembra_id: plan.id,
      preparacion_terreno_id: prep.id,
      catalogo_material_id: plan.catalogo_material_id,
      fecha_siembra: input.fecha_siembra,
      cantidad_palmas: input.cantidad_palmas,
      confirmacion_profundidad: true,
      confirmacion_orientacion: true,
      notas: input.notas?.trim() ?? null,
      created_by: session.user.id,
      source: input.source,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return actionError(insertErr?.message ?? "No se pudo registrar la siembra.");
  }

  const { error: loteUpErr } = await supabase
    .from("lotes")
    .update({
      estado_cultivo: "en_produccion",
      anio_siembra: anioSiembra,
      material_genetico: material.nombre,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.lote_id)
    .eq("estado_cultivo", "listo_para_siembra");

  if (loteUpErr) {
    return actionError(
      "Siembra registrada pero no se pudo actualizar el estado del lote. Contacte al administrador."
    );
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "siembra.registrar",
    titulo: "Registro de siembra de plántulas",
    detalle: {
      registroSiembraId: row.id,
      loteCodigo: lote.codigo,
      planSiembraId: plan.id,
      preparacionTerrenoId: prep.id,
      materialNombre: material.nombre,
      catalogoMaterialId: plan.catalogo_material_id,
      fechaSiembra: input.fecha_siembra,
      cantidadPalmas: input.cantidad_palmas,
      notas: input.notas?.trim() ?? null,
    },
  });

  return actionOk({ id: row.id });
}

export type RegistroSiembraListRow = {
  id: string;
  lote_codigo: string;
  material_nombre: string;
  fecha_siembra: string;
  cantidad_palmas: number;
  created_at: string;
};

export async function listRegistrosSiembraForFinca(
  fincaId: string
): Promise<ActionResult<RegistroSiembraListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registros_siembra")
    .select(
      "id, lote_id, fecha_siembra, cantidad_palmas, created_at, catalogo_material_id"
    )
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .order("fecha_siembra", { ascending: false })
    .limit(100);

  if (error) return actionError(error.message);

  const rows = data ?? [];
  const loteIds = [...new Set(rows.map((r) => r.lote_id))];
  const matIds = [...new Set(rows.map((r) => r.catalogo_material_id))];

  const [{ data: lotesRows }, { data: matRows }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    matIds.length
      ? supabase.from("catalogo_items").select("id, nombre").in("id", matIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));
  const matMap = new Map((matRows ?? []).map((m) => [m.id, m.nombre]));

  return actionOk(
    rows.map((r) => ({
      id: r.id,
      lote_codigo: loteMap.get(r.lote_id) ?? "—",
      material_nombre: matMap.get(r.catalogo_material_id) ?? "—",
      fecha_siembra: r.fecha_siembra,
      cantidad_palmas: r.cantidad_palmas,
      created_at: r.created_at,
    }))
  );
}
