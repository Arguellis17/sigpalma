"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  createSignedUrlsForStoragePaths,
  parseEvidenciaPaths,
} from "@/lib/storage-evidencia-tecnica";
import {
  isInsumoFitosanitarioProducto,
  isInsumoNutricion,
} from "@/lib/catalogo-insumo-fitosanitario";
import { estimarTotalPalmasLote } from "@/lib/censo-sanitario";
import { loteAptoParaCosecha } from "@/lib/cosecha-validacion";
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

/** HU27: lotes en producción, activos y con edad mínima de cosecha (RN78). */
export async function getLotesCosechables(
  fincaId: string,
  fechaCosecha?: string
): Promise<ActionResult<LoteOption[]>> {
  const id = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return actionError("Finca no válida.");
  }
  const fecha =
    fechaCosecha?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(fechaCosecha.trim())
      ? fechaCosecha.trim()
      : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lotes")
    .select("id, codigo, activo, estado_cultivo, anio_siembra")
    .eq("finca_id", id)
    .eq("activo", true)
    .eq("estado_cultivo", "en_produccion")
    .order("codigo");

  if (error) {
    return actionError(error.message);
  }

  const aptos = (data ?? []).filter((l) =>
    loteAptoParaCosecha(
      {
        activo: l.activo,
        estado_cultivo: l.estado_cultivo,
        anio_siembra: l.anio_siembra,
      },
      fecha
    ).ok
  );

  return actionOk(aptos.map((l) => ({ id: l.id, codigo: l.codigo })));
}

/** HU27: máximo peso histórico no anulado del lote (alerta de peso inusual). */
export async function getMaxPesoCosechaLote(
  loteId: string
): Promise<ActionResult<number | null>> {
  const lid = loteId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(lid)) {
    return actionError("Lote no válido.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cosechas_rff")
    .select("peso_kg")
    .eq("lote_id", lid)
    .eq("is_voided", false)
    .order("peso_kg", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return actionError(error.message);
  }
  if (!data) {
    return actionOk(null);
  }
  const n = Number(data.peso_kg);
  return actionOk(Number.isFinite(n) ? n : null);
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
  pendiente_ejecucion: boolean;
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
    .select(
      "id, lote_id, tipo, fecha_ejecucion, notas, catalogo_item_id, cantidad_ejecutada"
    )
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
      pendiente_ejecucion:
        r.cantidad_ejecutada == null && r.catalogo_item_id != null,
    }))
  );
}

export type LaborPendienteRow = {
  id: string;
  lote_id: string;
  lote_codigo: string;
  tipo: string;
  fecha_ejecucion: string;
  notas: string | null;
  catalogo_item_id: string;
};

/** HU21: labores programadas (HU11) pendientes de reporte de ejecución. */
export async function getLaboresPendientesEjecucion(
  fincaId: string,
  hastaFecha: string
): Promise<ActionResult<LaborPendienteRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hastaFecha)) {
    return actionError("Fecha límite inválida.");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("labores_agronomicas")
    .select("id, lote_id, tipo, fecha_ejecucion, notas, catalogo_item_id")
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .is("cantidad_ejecutada", null)
    .not("catalogo_item_id", "is", null)
    .lte("fecha_ejecucion", hastaFecha)
    .order("fecha_ejecucion");

  if (error) {
    return actionError(error.message);
  }

  const lr = (rows ?? []).filter(
    (r): r is typeof r & { catalogo_item_id: string } =>
      r.catalogo_item_id != null
  );
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

export type NutricionPendienteRow = {
  plan_item_id: string;
  plan_id: string;
  lote_id: string;
  lote_codigo: string;
  insumo_nombre: string;
  catalogo_insumo_id: string;
  dosis_cantidad: number;
  dosis_unidad: string;
  fecha_objetivo: string | null;
  unidad_medida: string | null;
  plan_nombre: string | null;
};

/** HU22: líneas de fertilización programadas (HU12) pendientes de aplicación. */
export async function getNutricionPendientesOperario(
  fincaId: string,
  hastaFecha: string
): Promise<ActionResult<NutricionPendienteRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hastaFecha)) {
    return actionError("Fecha límite inválida.");
  }

  const supabase = await createClient();

  const { data: planes, error: pe } = await supabase
    .from("planes_nutricion")
    .select("id, nombre, lote_id, lotes ( codigo, activo, estado_cultivo )")
    .eq("finca_id", fid)
    .eq("is_voided", false);

  if (pe) return actionError(pe.message);

  type PlanR = {
    id: string;
    nombre: string | null;
    lote_id: string;
    lotes: {
      codigo: string;
      activo: boolean;
      estado_cultivo: string;
    } | null;
  };

  const planesValidos = ((planes ?? []) as PlanR[]).filter(
    (p) =>
      p.lotes?.activo &&
      p.lotes.estado_cultivo === "en_produccion"
  );
  const planIds = planesValidos.map((p) => p.id);
  if (planIds.length === 0) {
    return actionOk([]);
  }

  const planMap = new Map(
    planesValidos.map((p) => [
      p.id,
      {
        lote_id: p.lote_id,
        lote_codigo: p.lotes?.codigo ?? "—",
        plan_nombre: p.nombre,
      },
    ])
  );

  const [{ data: itemsRaw, error: ie }, { data: appsRaw, error: ae }] =
    await Promise.all([
      supabase
        .from("planes_nutricion_items")
        .select(
          `
        id,
        plan_id,
        catalogo_insumo_id,
        dosis_cantidad,
        dosis_unidad,
        fecha_objetivo,
        catalogo_items ( nombre, unidad_medida )
      `
        )
        .in("plan_id", planIds)
        .order("fecha_objetivo", { ascending: true }),
      supabase
        .from("aplicaciones_fertilizacion")
        .select("plan_item_id")
        .eq("finca_id", fid)
        .eq("is_voided", false),
    ]);

  if (ie) return actionError(ie.message);
  if (ae) return actionError(ae.message);

  const appliedIds = new Set((appsRaw ?? []).map((a) => a.plan_item_id));

  type ItemR = {
    id: string;
    plan_id: string;
    catalogo_insumo_id: string;
    dosis_cantidad: number | string;
    dosis_unidad: string;
    fecha_objetivo: string | null;
    catalogo_items: { nombre: string; unidad_medida: string | null } | null;
  };

  const pendientes = ((itemsRaw ?? []) as ItemR[])
    .filter((it) => !appliedIds.has(it.id))
    .filter(
      (it) =>
        !it.fecha_objetivo || it.fecha_objetivo <= hastaFecha
    )
    .map((it) => {
      const plan = planMap.get(it.plan_id);
      if (!plan) return null;
      return {
        plan_item_id: it.id,
        plan_id: it.plan_id,
        lote_id: plan.lote_id,
        lote_codigo: plan.lote_codigo,
        insumo_nombre: it.catalogo_items?.nombre ?? "—",
        catalogo_insumo_id: it.catalogo_insumo_id,
        dosis_cantidad: Number(it.dosis_cantidad),
        dosis_unidad: it.dosis_unidad,
        fecha_objetivo: it.fecha_objetivo,
        unidad_medida: it.catalogo_items?.unidad_medida ?? null,
        plan_nombre: plan.plan_nombre,
      };
    })
    .filter((r): r is NutricionPendienteRow => r != null);

  return actionOk(pendientes);
}

export type PreparacionTerrenoPendienteRow = {
  lote_id: string;
  lote_codigo: string;
  plan_siembra_id: string;
  fecha_proyectada: string;
  material_nombre: string;
  pendiente_lote_pct: number | null;
};

/** HU19: lotes planificados (HU10) sin preparación de terreno registrada. */
export async function getLotesPendientesPreparacionTerreno(
  fincaId: string
): Promise<ActionResult<PreparacionTerrenoPendienteRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();

  const { data: lotes, error: le } = await supabase
    .from("lotes")
    .select("id, codigo, pendiente_pct")
    .eq("finca_id", fid)
    .eq("activo", true)
    .eq("estado_cultivo", "planificado_siembra")
    .order("codigo");

  if (le) return actionError(le.message);
  if (!lotes?.length) return actionOk([]);

  const loteIds = lotes.map((l) => l.id);

  const [{ data: planes, error: pe }, { data: preps, error: pre }] =
    await Promise.all([
      supabase
        .from("planes_siembra")
        .select(
          "id, lote_id, fecha_proyectada, catalogo_material_id, catalogo_items ( nombre )"
        )
        .in("lote_id", loteIds)
        .eq("is_voided", false),
      supabase
        .from("preparaciones_terreno")
        .select("lote_id")
        .in("lote_id", loteIds)
        .eq("is_voided", false),
    ]);

  if (pe) return actionError(pe.message);
  if (pre) return actionError(pre.message);

  const prepLoteIds = new Set((preps ?? []).map((p) => p.lote_id));
  const planByLote = new Map(
    (planes ?? []).map((p) => {
      const mat = (p as { catalogo_items?: { nombre?: string } | null })
        .catalogo_items?.nombre;
      return [
        p.lote_id,
        {
          plan_siembra_id: p.id,
          fecha_proyectada: p.fecha_proyectada,
          material_nombre: mat ?? "—",
        },
      ];
    })
  );

  const rows: PreparacionTerrenoPendienteRow[] = [];
  for (const l of lotes) {
    if (prepLoteIds.has(l.id)) continue;
    const plan = planByLote.get(l.id);
    if (!plan) continue;
    rows.push({
      lote_id: l.id,
      lote_codigo: l.codigo,
      plan_siembra_id: plan.plan_siembra_id,
      fecha_proyectada: plan.fecha_proyectada,
      material_nombre: plan.material_nombre,
      pendiente_lote_pct:
        l.pendiente_pct != null ? Number(l.pendiente_pct) : null,
    });
  }

  return actionOk(rows);
}

export type SiembraPendienteRow = {
  lote_id: string;
  lote_codigo: string;
  plan_siembra_id: string;
  preparacion_terreno_id: string;
  material_nombre: string;
  fecha_proyectada: string;
  area_ha: number;
  densidad_palmas_ha: number | null;
  max_palmas: number | null;
};

/** HU20: lotes listos para siembra con plan HU10 y preparación HU19 aprobada. */
export async function getLotesPendientesSiembra(
  fincaId: string
): Promise<ActionResult<SiembraPendienteRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();

  const { data: lotes, error: le } = await supabase
    .from("lotes")
    .select("id, codigo, area_ha, densidad_palmas_ha")
    .eq("finca_id", fid)
    .eq("activo", true)
    .eq("estado_cultivo", "listo_para_siembra")
    .order("codigo");

  if (le) return actionError(le.message);
  if (!lotes?.length) return actionOk([]);

  const loteIds = lotes.map((l) => l.id);

  const [{ data: preps, error: pe }, { data: siembras, error: se }] =
    await Promise.all([
      supabase
        .from("preparaciones_terreno")
        .select("id, lote_id, plan_siembra_id")
        .in("lote_id", loteIds)
        .eq("is_voided", false)
        .eq("estado", "aprobado"),
      supabase
        .from("registros_siembra")
        .select("lote_id")
        .in("lote_id", loteIds)
        .eq("is_voided", false),
    ]);

  if (pe) return actionError(pe.message);
  if (se) return actionError(se.message);

  const siembraLoteIds = new Set((siembras ?? []).map((s) => s.lote_id));
  const prepByLote = new Map(
    (preps ?? []).map((p) => [
      p.lote_id,
      { id: p.id, plan_siembra_id: p.plan_siembra_id },
    ])
  );

  const planIds = [...new Set((preps ?? []).map((p) => p.plan_siembra_id))];
  const { data: planes, error: plErr } = planIds.length
    ? await supabase
        .from("planes_siembra")
        .select("id, lote_id, fecha_proyectada, catalogo_material_id")
        .in("id", planIds)
        .eq("is_voided", false)
    : { data: [] as { id: string; lote_id: string; fecha_proyectada: string; catalogo_material_id: string }[], error: null };

  if (plErr) return actionError(plErr.message);

  const matIds = [...new Set((planes ?? []).map((p) => p.catalogo_material_id))];
  const { data: mats } = matIds.length
    ? await supabase.from("catalogo_items").select("id, nombre").in("id", matIds)
    : { data: [] as { id: string; nombre: string }[] };

  const matMap = new Map((mats ?? []).map((m) => [m.id, m.nombre]));
  const planMap = new Map(
    (planes ?? []).map((p) => [
      p.id,
      {
        lote_id: p.lote_id,
        fecha_proyectada: p.fecha_proyectada,
        material_nombre: matMap.get(p.catalogo_material_id) ?? "—",
      },
    ])
  );

  const rows: SiembraPendienteRow[] = [];
  for (const l of lotes) {
    if (siembraLoteIds.has(l.id)) continue;
    const prep = prepByLote.get(l.id);
    if (!prep) continue;
    const plan = planMap.get(prep.plan_siembra_id);
    if (!plan || plan.lote_id !== l.id) continue;

    const area = Number(l.area_ha);
    const densidad =
      l.densidad_palmas_ha != null ? Number(l.densidad_palmas_ha) : null;

    rows.push({
      lote_id: l.id,
      lote_codigo: l.codigo,
      plan_siembra_id: prep.plan_siembra_id,
      preparacion_terreno_id: prep.id,
      material_nombre: plan.material_nombre,
      fecha_proyectada: plan.fecha_proyectada,
      area_ha: area,
      densidad_palmas_ha: densidad,
      max_palmas: estimarTotalPalmasLote(area, densidad),
    });
  }

  return actionOk(rows);
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

/** HU25: plagas activas del catálogo fitosanitario (categoría plaga). */
export async function getCatalogoPlagas(): Promise<
  ActionResult<CatalogoFitosanidadOption[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre, categoria")
    .eq("activo", true)
    .eq("categoria", "plaga")
    .order("nombre");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as CatalogoFitosanidadOption[]);
}

/** HU26: enfermedades activas del catálogo fitosanitario (categoría enfermedad). */
export async function getCatalogoEnfermedades(): Promise<
  ActionResult<CatalogoFitosanidadOption[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre, categoria")
    .eq("activo", true)
    .eq("categoria", "enfermedad")
    .order("nombre");

  if (error) {
    return actionError(error.message);
  }

  return actionOk((data ?? []) as CatalogoFitosanidadOption[]);
}

/** Fila enriquecida para listado de alertas fitosanitarias del operario. */
export type AlertaFitosanitariaOperarioRow = {
  id: string;
  created_at: string;
  severidad: string;
  descripcion: string | null;
  validacion_estado: string | null;
  validacion_diagnostico: string | null;
  lote_codigo: string;
  amenaza: string | null;
  amenaza_categoria: string | null;
  evidencia_signed_urls: string[];
};

/**
 * Lista alertas fitosanitarias de una finca con lote, catálogo y URLs firmadas de evidencia.
 *
 * @param fincaId - UUID de la finca del operario
 */
export async function getAlertasFitosanitariasOperario(
  fincaId: string | null
): Promise<ActionResult<AlertaFitosanitariaOperarioRow[]>> {
  if (!fincaId) {
    return actionOk([]);
  }

  const supabase = await createClient();

  const { data: alertasRaw, error: alertErr } = await supabase
    .from("alertas_fitosanitarias")
    .select(
      "id, created_at, severidad, descripcion, validacion_estado, validacion_diagnostico, lote_id, catalogo_item_id, evidencia_urls"
    )
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (alertErr) {
    return actionError(alertErr.message);
  }

  const ar = alertasRaw ?? [];
  const loteIds = [...new Set(ar.map((a) => a.lote_id))];
  const catIds = [
    ...new Set(
      ar.map((a) => a.catalogo_item_id).filter((x): x is string => Boolean(x))
    ),
  ];

  const [{ data: lotesRows }, { data: catRows }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    catIds.length
      ? supabase
          .from("catalogo_items")
          .select("id, nombre, categoria")
          .in("id", catIds)
      : Promise.resolve(
          { data: [] as { id: string; nombre: string; categoria: string }[] }
        ),
  ]);

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));
  const catMap = new Map(
    (catRows ?? []).map((c) => [c.id, { nombre: c.nombre, categoria: c.categoria }])
  );

  const rows: AlertaFitosanitariaOperarioRow[] = [];
  for (const a of ar) {
    const cat = a.catalogo_item_id ? catMap.get(a.catalogo_item_id) : undefined;
    const paths = parseEvidenciaPaths(a.evidencia_urls);
    const evidenciaSignedUrls =
      paths.length > 0 ? await createSignedUrlsForStoragePaths(supabase, paths) : [];
    rows.push({
      id: a.id,
      created_at: a.created_at,
      severidad: a.severidad,
      descripcion: a.descripcion,
      validacion_estado: a.validacion_estado,
      validacion_diagnostico: a.validacion_diagnostico,
      lote_codigo: loteMap.get(a.lote_id) ?? "—",
      amenaza: cat?.nombre ?? null,
      amenaza_categoria: cat?.categoria ?? null,
      evidencia_signed_urls: evidenciaSignedUrls,
    });
  }

  return actionOk(rows);
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
    .not("proveedor", "is", null)
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
  compactacion: string | null;
  fertilidad_completa: string | null;
  textura: string | null;
  aluminio: string | null;
  cic: string | null;
  materia_organica_pct: string | null;
  drenaje_campo: string | null;
  nutrientes: Record<string, unknown> | null;
};

export async function getUltimoAnalisisSueloPorLote(
  loteId: string
): Promise<ActionResult<UltimoAnalisisSueloResumen | null>> {
  const lid = loteId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(lid)) {
    return actionError("Lote no válido.");
  }

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }

  const supabase = await createClient();
  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select("id, finca_id")
    .eq("id", lid)
    .maybeSingle();

  if (loteErr || !lote) {
    return actionError("Lote no encontrado.");
  }

  if (session.profile.role !== "superadmin") {
    if (!session.profile.finca_id || session.profile.finca_id !== lote.finca_id) {
      return actionError("No tiene acceso a este lote.");
    }
  }

  const { data, error } = await supabase
    .from("analisis_suelo")
    .select(
      "id, fecha_analisis, ph, humedad_pct, compactacion, fertilidad_completa, textura, aluminio, cic, materia_organica_pct, drenaje_campo, nutrientes"
    )
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
    compactacion: data.compactacion,
    fertilidad_completa: data.fertilidad_completa,
    textura: data.textura,
    aluminio: data.aluminio,
    cic: data.cic,
    materia_organica_pct: data.materia_organica_pct,
    drenaje_campo: data.drenaje_campo,
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

/** RF18: germinaciones / tratamiento térmico activos de la finca (listado operario / técnico). */
export type RegistroGerminacionListRow = {
  id: string;
  catalogo_material_id: string;
  material_nombre: string;
  lote_id: string | null;
  lote_codigo: string | null;
  fecha_tratamiento: string;
  temperatura_max_c: number;
  dias_tratamiento: number;
  notas: string | null;
  created_at: string;
};

export async function getRegistrosGerminacionPorFinca(
  fincaId: string
): Promise<ActionResult<RegistroGerminacionListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("registros_germinacion")
    .select(
      `
      id,
      catalogo_material_id,
      lote_id,
      fecha_tratamiento,
      temperatura_max_c,
      dias_tratamiento,
      notas,
      created_at,
      catalogo_items ( nombre ),
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
    catalogo_material_id: string;
    lote_id: string | null;
    fecha_tratamiento: string;
    temperatura_max_c: string | number;
    dias_tratamiento: number;
    notas: string | null;
    created_at: string;
    catalogo_items: { nombre: string } | null;
    lotes: { codigo: string } | null;
  };

  const mapped = ((rows ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    catalogo_material_id: r.catalogo_material_id,
    material_nombre: r.catalogo_items?.nombre ?? "—",
    lote_id: r.lote_id,
    lote_codigo: r.lotes?.codigo ?? null,
    fecha_tratamiento: r.fecha_tratamiento,
    temperatura_max_c: Number(r.temperatura_max_c),
    dias_tratamiento: r.dias_tratamiento,
    notas: r.notas,
    created_at: r.created_at,
  }));

  return actionOk(mapped);
}

/** Germinaciones sin evaluación de vivero activa (RF14 previo a crear evaluación). */
export async function getGerminacionesSinEvaluacionActiva(
  fincaId: string
): Promise<ActionResult<RegistroGerminacionListRow[]>> {
  const allRes = await getRegistrosGerminacionPorFinca(fincaId);
  if (!allRes.success) return allRes;
  const list = allRes.data;
  if (list.length === 0) return actionOk([]);

  const supabase = await createClient();
  const ids = list.map((g) => g.id);
  const { data: evs, error } = await supabase
    .from("evaluaciones_vivero")
    .select("germinacion_id")
    .in("germinacion_id", ids)
    .eq("is_voided", false);

  if (error) {
    return actionError(error.message);
  }

  const busy = new Set((evs ?? []).map((e) => e.germinacion_id as string));
  return actionOk(list.filter((g) => !busy.has(g.id)));
}

/** HU14 / RF14: historial de evaluaciones de vivero de la finca. */
export type EvaluacionViveroListRow = {
  id: string;
  germinacion_id: string;
  material_nombre: string;
  concepto: string;
  total_inicial: number;
  unidades_germinadas: number;
  unidades_descartadas: number;
  pct_germinacion: number | null;
  motivo_descarte: string | null;
  observaciones_fitosanitarias: string | null;
  evidencia_count: number;
  created_at: string;
  is_voided: boolean;
};

export async function getEvaluacionesViveroPorFinca(
  fincaId: string
): Promise<ActionResult<EvaluacionViveroListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("evaluaciones_vivero")
    .select(
      `
      id,
      germinacion_id,
      concepto,
      total_inicial,
      unidades_germinadas,
      unidades_descartadas,
      pct_germinacion,
      motivo_descarte,
      observaciones_fitosanitarias,
      evidencia_urls,
      created_at,
      is_voided,
      registros_germinacion (
        catalogo_items ( nombre )
      )
    `
    )
    .eq("finca_id", fid)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return actionError(error.message);
  }

  type Raw = {
    id: string;
    germinacion_id: string;
    concepto: string;
    total_inicial: number;
    unidades_germinadas: number;
    unidades_descartadas: number;
    pct_germinacion: string | number | null;
    motivo_descarte: string | null;
    observaciones_fitosanitarias: string | null;
    evidencia_urls: unknown;
    created_at: string;
    is_voided: boolean;
    registros_germinacion: { catalogo_items: { nombre: string } | null } | null;
  };

  const mapped = ((rows ?? []) as Raw[]).map((r) => {
    const urls = r.evidencia_urls;
    const evidenciaCount = Array.isArray(urls) ? urls.length : 0;
    const pct =
      r.pct_germinacion === null || r.pct_germinacion === undefined
        ? null
        : Number(r.pct_germinacion);
    return {
      id: r.id,
      germinacion_id: r.germinacion_id,
      material_nombre: r.registros_germinacion?.catalogo_items?.nombre ?? "—",
      concepto: r.concepto,
      total_inicial: r.total_inicial,
      unidades_germinadas: r.unidades_germinadas,
      unidades_descartadas: r.unidades_descartadas,
      pct_germinacion: Number.isFinite(pct) ? pct : null,
      motivo_descarte: r.motivo_descarte,
      observaciones_fitosanitarias: r.observaciones_fitosanitarias,
      evidencia_count: evidenciaCount,
      created_at: r.created_at,
      is_voided: r.is_voided,
    };
  });

  return actionOk(mapped);
}
