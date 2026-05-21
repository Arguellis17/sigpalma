"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, hasRole, isSuperAdmin } from "@/lib/auth/session-profile";
import { isInsumoNutricion } from "@/lib/catalogo-insumo-fitosanitario";
import { calcularDesviacionPct } from "@/lib/fertilizacion-dosis";
import {
  registrarAplicacionFertilizacionSchema,
  validarJustificacionDesviacionFertilizacion,
  type RegistrarAplicacionFertilizacionInput,
} from "@/lib/validations/fertilizacion";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export async function registrarAplicacionFertilizacion(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarAplicacionFertilizacionSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarAplicacionFertilizacionInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user) {
    return actionError("Sesión no válida.");
  }
  const profile = session.profile;
  if (!hasRole(profile, ["operario", "agronomo", "superadmin"])) {
    return actionError("Solo operario o agrónomo pueden registrar fertilización.");
  }
  if (!profile?.finca_id && profile?.role !== "superadmin") {
    return actionError("Su cuenta no tiene finca asignada.");
  }
  if (
    profile?.role !== "superadmin" &&
    profile?.finca_id &&
    profile.finca_id !== input.finca_id
  ) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();

  const { data: item, error: itemErr } = await supabase
    .from("planes_nutricion_items")
    .select(
      `
      id,
      plan_id,
      catalogo_insumo_id,
      dosis_cantidad,
      dosis_unidad,
      planes_nutricion (
        id,
        finca_id,
        lote_id,
        is_voided
      )
    `
    )
    .eq("id", input.plan_item_id)
    .maybeSingle();

  if (itemErr || !item) {
    return actionError("Línea de fertilización programada no encontrada.");
  }

  const plan = (
    item as {
      planes_nutricion: {
        id: string;
        finca_id: string;
        lote_id: string;
        is_voided: boolean;
      } | null;
    }
  ).planes_nutricion;

  if (!plan || plan.is_voided) {
    return actionError("El plan nutricional no está disponible.");
  }
  if (plan.finca_id !== input.finca_id) {
    return actionError("La línea programada no pertenece a su finca.");
  }

  const { data: existApp } = await supabase
    .from("aplicaciones_fertilizacion")
    .select("id")
    .eq("plan_item_id", input.plan_item_id)
    .eq("is_voided", false)
    .maybeSingle();
  if (existApp) {
    return actionError("Esta línea de fertilización ya fue registrada como aplicada.");
  }

  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select("codigo, activo, estado_cultivo, finca_id")
    .eq("id", plan.lote_id)
    .maybeSingle();

  if (loteErr || !lote) {
    return actionError("Lote del plan no encontrado.");
  }
  if (lote.finca_id !== input.finca_id) {
    return actionError("El lote no pertenece a la finca.");
  }
  if (!lote.activo) {
    return actionError("El lote no está activo.");
  }
  if (lote.estado_cultivo !== "en_produccion") {
    return actionError("Solo se puede fertilizar lotes en producción.");
  }

  const dosisProgramada = Number(item.dosis_cantidad);
  const justificacionErr = validarJustificacionDesviacionFertilizacion(
    input.cantidad_aplicada,
    dosisProgramada,
    input.justificacion_desviacion
  );
  if (justificacionErr) {
    return actionError(justificacionErr);
  }

  const { data: insumo, error: insumoErr } = await supabase
    .from("catalogo_items")
    .select("id, nombre, categoria, subcategoria, activo, unidad_medida")
    .eq("id", item.catalogo_insumo_id)
    .maybeSingle();

  if (insumoErr || !insumo) {
    return actionError("Insumo del plan no encontrado.");
  }
  if (!insumo.activo) {
    return actionError("El insumo programado está inactivo.");
  }
  if (insumo.categoria !== "insumo" || !isInsumoNutricion(insumo.subcategoria)) {
    return actionError(
      "Solo se permiten insumos de nutrición/fertilización del catálogo (RN62)."
    );
  }
  if (item.catalogo_insumo_id !== insumo.id) {
    return actionError("El insumo no coincide con la programación.");
  }

  const desviacionPct = calcularDesviacionPct(
    input.cantidad_aplicada,
    dosisProgramada
  );

  const { data: row, error: insertErr } = await supabase
    .from("aplicaciones_fertilizacion")
    .insert({
      finca_id: input.finca_id,
      lote_id: plan.lote_id,
      plan_id: plan.id,
      plan_item_id: input.plan_item_id,
      catalogo_insumo_id: item.catalogo_insumo_id,
      fecha_aplicacion: input.fecha_aplicacion,
      cantidad_aplicada: input.cantidad_aplicada,
      dosis_programada: dosisProgramada,
      dosis_unidad: item.dosis_unidad,
      desviacion_pct: desviacionPct,
      justificacion_desviacion: input.justificacion_desviacion?.trim() || null,
      metodo_aplicacion: input.metodo_aplicacion,
      unidad_medida: insumo.unidad_medida,
      latitud: input.latitud!,
      longitud: input.longitud!,
      notas: input.notas?.trim() ?? null,
      created_by: session.user.id,
      source: input.source,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return actionError(insertErr?.message ?? "No se pudo registrar la aplicación.");
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "nutricion.aplicacion_fertilizacion",
    titulo: "Aplicación de fertilización registrada",
    detalle: {
      aplicacionId: row.id,
      planId: plan.id,
      planItemId: input.plan_item_id,
      loteCodigo: lote.codigo,
      insumoNombre: insumo.nombre,
      dosisProgramada,
      dosisUnidad: item.dosis_unidad,
      cantidadAplicada: input.cantidad_aplicada,
      desviacionPct,
      metodoAplicacion: input.metodo_aplicacion,
      fechaAplicacion: input.fecha_aplicacion,
      justificacion: input.justificacion_desviacion?.trim() ?? null,
      coordenadas: `${input.latitud}, ${input.longitud}`,
    },
  });

  return actionOk({ id: row.id });
}

export type AplicacionFertilizacionListRow = {
  id: string;
  fecha_aplicacion: string;
  lote_codigo: string;
  insumo_nombre: string;
  cantidad_aplicada: number;
  dosis_programada: number;
  dosis_unidad: string;
  desviacion_pct: number;
  metodo_aplicacion: string;
  unidad_medida: string | null;
  created_at: string;
};

export async function listAplicacionesFertilizacionForFinca(
  fincaId: string
): Promise<ActionResult<AplicacionFertilizacionListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aplicaciones_fertilizacion")
    .select(
      "id, fecha_aplicacion, cantidad_aplicada, dosis_programada, dosis_unidad, desviacion_pct, metodo_aplicacion, unidad_medida, created_at, lote_id, catalogo_insumo_id"
    )
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .order("fecha_aplicacion", { ascending: false })
    .limit(200);

  if (error) {
    return actionError(error.message);
  }

  const rows = data ?? [];
  const loteIds = [...new Set(rows.map((r) => r.lote_id))];
  const insumoIds = [...new Set(rows.map((r) => r.catalogo_insumo_id))];

  const [{ data: lotesRows }, { data: insumosRows }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    insumoIds.length
      ? supabase.from("catalogo_items").select("id, nombre").in("id", insumoIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));
  const insumoMap = new Map((insumosRows ?? []).map((i) => [i.id, i.nombre]));

  return actionOk(
    rows.map((r) => ({
      id: r.id,
      fecha_aplicacion: r.fecha_aplicacion,
      lote_codigo: loteMap.get(r.lote_id) ?? "—",
      insumo_nombre: insumoMap.get(r.catalogo_insumo_id) ?? "—",
      cantidad_aplicada: Number(r.cantidad_aplicada),
      dosis_programada: Number(r.dosis_programada),
      dosis_unidad: r.dosis_unidad,
      desviacion_pct: Number(r.desviacion_pct),
      metodo_aplicacion: r.metodo_aplicacion,
      unidad_medida: r.unidad_medida,
      created_at: r.created_at,
    }))
  );
}

export async function anularAplicacionFertilizacion(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = zSafeId(raw);
  if (!parsed.success) return parsed;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  const { profile } = session;
  if (
    profile.role !== "operario" &&
    profile.role !== "agronomo" &&
    !isSuperAdmin(profile)
  ) {
    return actionError("No tiene permiso para anular aplicaciones.");
  }

  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("aplicaciones_fertilizacion")
    .select("id, finca_id, is_voided")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (fetchErr || !row) {
    return actionError("Registro no encontrado.");
  }
  if (row.is_voided) {
    return actionError("El registro ya está anulado.");
  }
  if (!isSuperAdmin(profile) && profile.finca_id !== row.finca_id) {
    return actionError("No puede anular registros de otra finca.");
  }

  const { data, error } = await supabase
    .from("aplicaciones_fertilizacion")
    .update({ is_voided: true, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(error?.message ?? "No se pudo anular.");
  }

  return actionOk({ id: data.id });
}

function zSafeId(raw: unknown): ActionResult<{ id: string }> {
  const id =
    raw && typeof raw === "object" && "id" in raw
      ? String((raw as { id: unknown }).id)
      : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return actionError("Identificador no válido.");
  }
  return actionOk({ id });
}
