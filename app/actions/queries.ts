"use server";

import { createClient } from "@/lib/supabase/server";
import { isInsumoFitosanitarioProducto } from "@/lib/catalogo-insumo-fitosanitario";
import { actionError, actionOk, type ActionResult } from "./types";

export type LoteOption = { id: string; codigo: string };

export async function getLotesPorFinca(
  fincaId: string,
  options?: { soloActivos?: boolean }
): Promise<ActionResult<LoteOption[]>> {
  const id = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  let q = supabase.from("lotes").select("id, codigo").eq("finca_id", id);
  if (options?.soloActivos) {
    q = q.eq("activo", true);
  }
  const { data, error } = await q.order("codigo");

  if (error) {
    return actionError(error.message);
  }

  return actionOk(data ?? []);
}

export type CatalogoLaborOption = { id: string; nombre: string };

export async function getCatalogoLabores(): Promise<
  ActionResult<CatalogoLaborOption[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre")
    .eq("categoria", "labor")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as CatalogoLaborOption[]);
}

export type LaborAgendaRow = {
  id: string;
  lote_id: string;
  lote_codigo: string;
  tipo: string;
  fecha_ejecucion: string;
  notas: string | null;
  catalogo_item_id: string | null;
};

export async function getLaboresRango(
  fincaId: string,
  desde: string,
  hasta: string
): Promise<ActionResult<LaborAgendaRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return actionError("Rango de fechas inválido.");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("labores_agronomicas")
    .select("id, lote_id, tipo, fecha_ejecucion, notas, catalogo_item_id")
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .gte("fecha_ejecucion", desde)
    .lte("fecha_ejecucion", hasta)
    .order("fecha_ejecucion");

  if (error) {
    return actionError(error.message);
  }

  const lr = rows ?? [];
  const loteIds = [...new Set(lr.map((r) => r.lote_id))];
  const { data: lotesRows } = loteIds.length
    ? await supabase.from("lotes").select("id, codigo").in("id", loteIds)
    : { data: [] as { id: string; codigo: string }[] };

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));

  return actionOk(
    lr.map((r) => ({
      id: r.id,
      lote_id: r.lote_id,
      lote_codigo: loteMap.get(r.lote_id) ?? "—",
      tipo: r.tipo,
      fecha_ejecucion: r.fecha_ejecucion,
      notas: r.notas,
      catalogo_item_id: r.catalogo_item_id,
    }))
  );
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
    .in("categoria", ["plaga", "enfermedad", "otro"])
    .order("categoria")
    .order("nombre");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as CatalogoFitosanidadOption[]);
}

export type InsumoFitosanitarioOption = {
  id: string;
  nombre: string;
  subcategoria: string | null;
  unidad_medida: string | null;
};

/** Insumos activos clasificados como producto fitosanitario (RN65). */
export async function getInsumosFitosanitariosActivos(): Promise<
  ActionResult<InsumoFitosanitarioOption[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre, subcategoria, unidad_medida, categoria")
    .eq("categoria", "insumo")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    return actionError(error.message);
  }

  const filtered = (data ?? []).filter((r) =>
    isInsumoFitosanitarioProducto({
      categoria: r.categoria,
      subcategoria: r.subcategoria,
    })
  );

  return actionOk(
    filtered.map(({ id, nombre, subcategoria, unidad_medida }) => ({
      id,
      nombre,
      subcategoria,
      unidad_medida,
    }))
  );
}

export type CatalogoMaterialGeneticoOption = { id: string; nombre: string };

/** Catálogo RF06 / RN27: variedades certificadas para planificación de siembra (HU10). */
export async function getCatalogoMaterialGenetico(): Promise<
  ActionResult<CatalogoMaterialGeneticoOption[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre")
    .eq("categoria", "material_genetico")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as CatalogoMaterialGeneticoOption[]);
}

export type LotePlanificableOption = {
  id: string;
  codigo: string;
  pendiente_pct: string | null;
};

/** RN26: lotes activos en estado vacante o disponible (no cultivo establecido ni ya planificado). */
export async function getLotesPlanificables(
  fincaId: string
): Promise<ActionResult<LotePlanificableOption[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lotes")
    .select("id, codigo, pendiente_pct")
    .eq("finca_id", fid)
    .eq("activo", true)
    .in("estado_cultivo", ["vacante", "disponible"])
    .order("codigo");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as LotePlanificableOption[]);
}

export type PlanSiembraListRow = {
  id: string;
  lote_id: string;
  fecha_proyectada: string;
  confirmacion_erosion: boolean;
  notas: string | null;
  catalogo_material_id: string;
  lote_codigo: string;
  pendiente_pct: string | null;
  material_nombre: string;
};

type PlanSiembraRaw = {
  id: string;
  lote_id: string;
  fecha_proyectada: string;
  confirmacion_erosion: boolean;
  notas: string | null;
  catalogo_material_id: string;
  lotes: { codigo: string; pendiente_pct: string | null } | null;
  catalogo_items: { nombre: string } | null;
};

export async function getPlanesSiembraPorFinca(
  fincaId: string
): Promise<ActionResult<PlanSiembraListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planes_siembra")
    .select(
      `
      id,
      lote_id,
      fecha_proyectada,
      confirmacion_erosion,
      notas,
      catalogo_material_id,
      lotes ( codigo, pendiente_pct ),
      catalogo_items ( nombre )
    `
    )
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .order("fecha_proyectada", { ascending: true });

  if (error) {
    return actionError(error.message);
  }

  const mapped = ((data ?? []) as PlanSiembraRaw[]).map((r) => ({
    id: r.id,
    lote_id: r.lote_id,
    fecha_proyectada: r.fecha_proyectada,
    confirmacion_erosion: r.confirmacion_erosion,
    notas: r.notas,
    catalogo_material_id: r.catalogo_material_id,
    lote_codigo: r.lotes?.codigo ?? "—",
    pendiente_pct: r.lotes?.pendiente_pct ?? null,
    material_nombre: r.catalogo_items?.nombre ?? "—",
  }));

  return actionOk(mapped);
}
