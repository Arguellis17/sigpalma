"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  isInsumoFitosanitarioProducto,
  isInsumoNutricion,
} from "@/lib/catalogo-insumo-fitosanitario";
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

export type InsumoNutricionOption = {
  id: string;
  nombre: string;
  subcategoria: string | null;
  unidad_medida: string | null;
};

/** Insumos activos de nutrición (RN32 HU12). */
export async function getInsumosNutricionActivos(): Promise<
  ActionResult<InsumoNutricionOption[]>
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
    isInsumoNutricion(r.subcategoria)
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

export type PlanNutricionListRow = {
  id: string;
  lote_id: string;
  lote_codigo: string;
  nombre: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  notas: string | null;
  locked_at: string | null;
  created_at: string;
};

export async function getPlanesNutricionPorFinca(
  fincaId: string
): Promise<ActionResult<PlanNutricionListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planes_nutricion")
    .select(
      `
      id,
      lote_id,
      nombre,
      fecha_inicio,
      fecha_fin,
      notas,
      locked_at,
      created_at,
      lotes ( codigo )
    `
    )
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .order("created_at", { ascending: false });

  if (error) {
    return actionError(error.message);
  }

  type Raw = {
    id: string;
    lote_id: string;
    nombre: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    notas: string | null;
    locked_at: string | null;
    created_at: string;
    lotes: { codigo: string } | null;
  };

  const mapped = ((data ?? []) as Raw[]).map((r) => ({
    id: r.id,
    lote_id: r.lote_id,
    lote_codigo: r.lotes?.codigo ?? "—",
    nombre: r.nombre,
    fecha_inicio: r.fecha_inicio,
    fecha_fin: r.fecha_fin,
    notas: r.notas,
    locked_at: r.locked_at,
    created_at: r.created_at,
  }));

  return actionOk(mapped);
}

export type UltimoAnalisisSueloResumen = {
  id: string;
  fecha_analisis: string;
  ph: string | null;
  humedad_pct: string | null;
  nutrientes: Record<string, unknown> | null;
};

export async function getUltimoAnalisisSueloPorLote(
  loteId: string
): Promise<ActionResult<UltimoAnalisisSueloResumen | null>> {
  const lid = loteId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(lid)) {
    return actionError("Lote no válido.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analisis_suelo")
    .select("id, fecha_analisis, ph, humedad_pct, nutrientes")
    .eq("lote_id", lid)
    .eq("is_voided", false)
    .order("fecha_analisis", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return actionError(error.message);
  }

  if (!data) {
    return actionOk(null);
  }

  return actionOk({
    id: data.id,
    fecha_analisis: data.fecha_analisis,
    ph: data.ph,
    humedad_pct: data.humedad_pct,
    nutrientes: (data.nutrientes as Record<string, unknown> | null) ?? null,
  });
}

export type PlanNutricionItemDetalle = {
  id: string;
  catalogo_insumo_id: string;
  insumo_nombre: string;
  dosis_cantidad: string;
  dosis_unidad: "por_ha" | "por_palma";
  frecuencia: string;
  fecha_objetivo: string | null;
  notas: string | null;
};

export type PlanRiegoItemDetalle = {
  id: string;
  descripcion: string;
  intervalo_dias: number | null;
  proxima_fecha: string;
  volumen_o_tiempo: string | null;
  notas: string | null;
};

export type PlanNutricionDetalle = {
  id: string;
  finca_id: string;
  lote_id: string;
  lote_codigo: string;
  nombre: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  notas: string | null;
  locked_at: string | null;
  items: PlanNutricionItemDetalle[];
  riego: PlanRiegoItemDetalle[];
};

export async function getPlanNutricionDetalle(
  planId: string
): Promise<ActionResult<PlanNutricionDetalle>> {
  const pid = planId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(pid)) {
    return actionError("Plan no válido.");
  }

  const supabase = await createClient();
  const { data: plan, error: pe } = await supabase
    .from("planes_nutricion")
    .select(
      `
      id,
      finca_id,
      lote_id,
      nombre,
      fecha_inicio,
      fecha_fin,
      notas,
      locked_at,
      lotes ( codigo )
    `
    )
    .eq("id", pid)
    .eq("is_voided", false)
    .maybeSingle();

  if (pe || !plan) {
    return actionError("Plan no encontrado.");
  }

  const p = plan as {
    id: string;
    finca_id: string;
    lote_id: string;
    nombre: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    notas: string | null;
    locked_at: string | null;
    lotes: { codigo: string } | null;
  };

  const [{ data: itemsRaw, error: ie }, { data: riegoRaw, error: re }] =
    await Promise.all([
      supabase
        .from("planes_nutricion_items")
        .select(
          `
        id,
        catalogo_insumo_id,
        dosis_cantidad,
        dosis_unidad,
        frecuencia,
        fecha_objetivo,
        notas,
        catalogo_items ( nombre )
      `
        )
        .eq("plan_id", pid)
        .order("created_at", { ascending: true }),
      supabase
        .from("planes_riego_items")
        .select(
          "id, descripcion, intervalo_dias, proxima_fecha, volumen_o_tiempo, notas"
        )
        .eq("plan_id", pid)
        .order("created_at", { ascending: true }),
    ]);

  if (ie) return actionError(ie.message);
  if (re) return actionError(re.message);

  type ItemR = {
    id: string;
    catalogo_insumo_id: string;
    dosis_cantidad: string;
    dosis_unidad: "por_ha" | "por_palma";
    frecuencia: string;
    fecha_objetivo: string | null;
    notas: string | null;
    catalogo_items: { nombre: string } | null;
  };

  const items: PlanNutricionItemDetalle[] = ((itemsRaw ?? []) as ItemR[]).map(
    (r) => ({
      id: r.id,
      catalogo_insumo_id: r.catalogo_insumo_id,
      insumo_nombre: r.catalogo_items?.nombre ?? "—",
      dosis_cantidad: r.dosis_cantidad,
      dosis_unidad: r.dosis_unidad,
      frecuencia: r.frecuencia,
      fecha_objetivo: r.fecha_objetivo,
      notas: r.notas,
    })
  );

  const riego: PlanRiegoItemDetalle[] = (riegoRaw ?? []).map(
    (r: {
      id: string;
      descripcion: string;
      intervalo_dias: number | null;
      proxima_fecha: string;
      volumen_o_tiempo: string | null;
      notas: string | null;
    }) => ({
      id: r.id,
      descripcion: r.descripcion,
      intervalo_dias: r.intervalo_dias,
      proxima_fecha: r.proxima_fecha,
      volumen_o_tiempo: r.volumen_o_tiempo,
      notas: r.notas,
    })
  );

  return actionOk({
    id: p.id,
    finca_id: p.finca_id,
    lote_id: p.lote_id,
    lote_codigo: p.lotes?.codigo ?? "—",
    nombre: p.nombre,
    fecha_inicio: p.fecha_inicio,
    fecha_fin: p.fecha_fin,
    notas: p.notas,
    locked_at: p.locked_at,
    items,
    riego,
  });
}

export type OperarioFincaOption = { id: string; full_name: string };

/** Operarios activos de la finca (HU13 asignación). Requiere sesión agrónomo + RLS. */
export async function getOperariosFinca(
  fincaId: string
): Promise<ActionResult<OperarioFincaOption[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("finca_id", fid)
    .eq("role", "operario")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as OperarioFincaOption[]);
}

export type MonitoreoProgramadoRow = {
  id: string;
  lote_id: string;
  lote_codigo: string;
  fecha_inspeccion: string;
  assigned_to: string;
  asignado_nombre: string;
  notas: string | null;
  estado: string;
  is_voided: boolean;
  created_at: string;
};

export async function getMonitoreosFitosanitariosRango(
  fincaId: string,
  desde: string,
  hasta: string
): Promise<ActionResult<MonitoreoProgramadoRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return actionError("Rango de fechas inválido.");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .select(
      `
      id,
      lote_id,
      fecha_inspeccion,
      assigned_to,
      notas,
      estado,
      is_voided,
      created_at,
      lotes ( codigo )
    `
    )
    .eq("finca_id", fid)
    .gte("fecha_inspeccion", desde)
    .lte("fecha_inspeccion", hasta)
    .order("fecha_inspeccion");

  if (error) {
    return actionError(error.message);
  }

  type Raw = {
    id: string;
    lote_id: string;
    fecha_inspeccion: string;
    assigned_to: string;
    notas: string | null;
    estado: string;
    is_voided: boolean;
    created_at: string;
    lotes: { codigo: string } | null;
  };

  const rawList = (rows ?? []) as Raw[];
  const assigneeIds = [...new Set(rawList.map((r) => r.assigned_to))];
  const nameById = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: profs, error: pe } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assigneeIds);
    if (pe) {
      return actionError(pe.message);
    }
    for (const p of profs ?? []) {
      nameById.set(p.id, (p.full_name as string)?.trim() || "Operario");
    }
  }

  const mapped = rawList.map((r) => ({
    id: r.id,
    lote_id: r.lote_id,
    lote_codigo: r.lotes?.codigo ?? "—",
    fecha_inspeccion: r.fecha_inspeccion,
    assigned_to: r.assigned_to,
    asignado_nombre: nameById.get(r.assigned_to) ?? "Operario",
    notas: r.notas,
    estado: r.estado,
    is_voided: r.is_voided,
    created_at: r.created_at,
  }));

  return actionOk(mapped);
}

export type MonitoreoPendienteOperarioRow = {
  id: string;
  lote_codigo: string;
  fecha_inspeccion: string;
  notas: string | null;
};

/** RN37: monitoreos pendientes asignados al operario actual. */
export async function getMonitoreosPendientesOperario(): Promise<
  ActionResult<MonitoreoPendienteOperarioRow[]>
> {
  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "operario") {
    return actionError("Solo disponible para operarios.");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .select(
      `
      id,
      fecha_inspeccion,
      notas,
      lotes ( codigo )
    `
    )
    .eq("assigned_to", session.user.id)
    .eq("estado", "pendiente")
    .eq("is_voided", false)
    .order("fecha_inspeccion");

  if (error) {
    return actionError(error.message);
  }

  type Raw = {
    id: string;
    fecha_inspeccion: string;
    notas: string | null;
    lotes: { codigo: string } | null;
  };

  return actionOk(
    ((rows ?? []) as Raw[]).map((r) => ({
      id: r.id,
      lote_codigo: r.lotes?.codigo ?? "—",
      fecha_inspeccion: r.fecha_inspeccion,
      notas: r.notas,
    }))
  );
}
