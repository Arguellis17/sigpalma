"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { registrarEventoFinca } from "@/app/actions/audit";
import { actionError, actionOk, type ActionResult } from "@/app/actions/types";
import type {
  TimelineEvent,
  TimelineEventCategory,
  TrazabilidadLoteCabecera,
  TrazabilidadResumen,
  TrazabilidadTecnicaLotePayload,
} from "@/lib/trazabilidad/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ymdToSortIso(ymd: string): string {
  const p = ymd.split("-").map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) {
    return new Date().toISOString();
  }
  const [y, m, d] = p;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
}

function rendimientoTonHa(pesoKg: number, areaHa: number): number {
  if (!Number.isFinite(areaHa) || areaHa <= 0 || !Number.isFinite(pesoKg)) return 0;
  return (pesoKg / 1000) / areaHa;
}

function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  const ta = new Date(a.sortAt).getTime();
  const tb = new Date(b.sortAt).getTime();
  if (tb !== ta) return tb - ta;
  return b.id.localeCompare(a.id);
}

function emptyConteo(): Record<TimelineEventCategory, number> {
  return {
    material_plan: 0,
    vivero: 0,
    labor: 0,
    nutricion: 0,
    sanidad: 0,
    suelo: 0,
    cosecha: 0,
  };
}

type GetTrazabilidadOptions = {
  /** Por defecto true (HU17 auditoría). Desactivar solo en pruebas internas. */
  recordAudit?: boolean;
};

/**
 * HU17 — Trazabilidad técnica por lote: agrega planes de siembra, labores, nutrición,
 * alertas, aplicaciones fitosanitarias y cosechas; orden descendente (RN01).
 */
export async function getTrazabilidadTecnicaLote(
  loteId: string,
  options: GetTrazabilidadOptions = {}
): Promise<ActionResult<TrazabilidadTecnicaLotePayload>> {
  const recordAudit = options.recordAudit !== false;
  const lid = loteId.trim();
  if (!UUID_RE.test(lid)) {
    return actionError("Identificador de lote no válido.");
  }

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }

  const { profile } = session;
  if (profile.role !== "agronomo" && !isSuperAdmin(profile)) {
    return actionError("Solo el técnico agrónomo puede consultar la trazabilidad técnica.");
  }

  const supabase = await createClient();

  const { data: loteRow, error: loteErr } = await supabase
    .from("lotes")
    .select(
      "id, codigo, finca_id, area_ha, activo, estado_cultivo, material_genetico, anio_siembra"
    )
    .eq("id", lid)
    .maybeSingle();

  if (loteErr || !loteRow) {
    return actionError(loteErr?.message ?? "Lote no encontrado.");
  }

  if (!isSuperAdmin(profile)) {
    if (profile.role !== "agronomo" || !profile.finca_id) {
      return actionError("No tiene finca asignada para consultar trazabilidad.");
    }
    if (profile.finca_id !== loteRow.finca_id) {
      return actionError("El lote no pertenece a su finca asignada.");
    }
  }

  const fincaId = loteRow.finca_id;
  const areaHa = Number(loteRow.area_ha);

  const [
    planesSiembraRes,
    preparacionesTerrenoRes,
    registrosSiembraRes,
    laboresRes,
    planesNutRes,
    alertasRes,
    aplicacionesRes,
    fertilizacionRes,
    analisisSueloRes,
    censosRes,
    cosechasRes,
    lotesFincaRes,
    cosechasFincaRes,
  ] = await Promise.all([
    supabase
      .from("planes_siembra")
      .select(
        "id, fecha_proyectada, confirmacion_erosion, notas, created_at, catalogo_material_id, catalogo_items ( nombre )"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("fecha_proyectada", { ascending: false }),
    supabase
      .from("preparaciones_terreno")
      .select(
        "id, pendiente_final_pct, actividades, estado, notas, created_at"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("registros_siembra")
      .select(
        "id, fecha_siembra, cantidad_palmas, notas, created_at, catalogo_material_id, catalogo_items ( nombre )"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("fecha_siembra", { ascending: false }),
    supabase
      .from("labores_agronomicas")
      .select(
        "id, tipo, fecha_ejecucion, notas, created_at, catalogo_item_id, cantidad_ejecutada, unidad_medida, ejecutada_at, catalogo_items ( nombre )"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .not("cantidad_ejecutada", "is", null)
      .order("fecha_ejecucion", { ascending: false }),
    supabase
      .from("planes_nutricion")
      .select(
        `
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        notas,
        created_at,
        planes_nutricion_items (
          id,
          dosis_cantidad,
          dosis_unidad,
          frecuencia,
          fecha_objetivo,
          notas,
          catalogo_items ( nombre )
        ),
        planes_riego_items (
          id,
          descripcion,
          proxima_fecha,
          intervalo_dias,
          volumen_o_tiempo,
          notas
        )
      `
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("alertas_fitosanitarias")
      .select(
        "id, severidad, descripcion, created_at, validacion_estado, validacion_diagnostico, catalogo_items ( nombre )"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("aplicaciones_fitosanitarias")
      .select(
        "id, fecha_aplicacion, cantidad_aplicada, unidad_medida, notas, created_at, catalogo_items ( nombre )"
      )
      .eq("lote_id", lid)
      .order("fecha_aplicacion", { ascending: false }),
    supabase
      .from("aplicaciones_fertilizacion")
      .select(
        "id, fecha_aplicacion, cantidad_aplicada, dosis_programada, dosis_unidad, desviacion_pct, metodo_aplicacion, notas, created_at, catalogo_insumo_id"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("fecha_aplicacion", { ascending: false }),
    supabase
      .from("analisis_suelo")
      .select(
        "id, fecha_analisis, ph, humedad_pct, compactacion, fertilidad_completa, textura, aluminio, cic, materia_organica_pct, drenaje_campo, notas, archivo_url, created_at"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("fecha_analisis", { ascending: false }),
    supabase
      .from("censos_sanitarios")
      .select(
        "id, fecha_censo, palmas_inspeccionadas, palmas_afectadas, incidencia_pct, supera_umbral, notas, created_at, catalogo_items ( nombre )"
      )
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("fecha_censo", { ascending: false }),
    supabase
      .from("cosechas_rff")
      .select("id, fecha, peso_kg, conteo_racimos, observaciones_calidad, created_at")
      .eq("lote_id", lid)
      .eq("is_voided", false)
      .order("fecha", { ascending: false }),
    supabase.from("lotes").select("id, area_ha").eq("finca_id", fincaId),
    supabase
      .from("cosechas_rff")
      .select("id, lote_id, fecha, peso_kg")
      .eq("finca_id", fincaId)
      .eq("is_voided", false)
      .order("fecha", { ascending: false })
      .limit(400),
  ]);

  const errs = [
    planesSiembraRes.error,
    preparacionesTerrenoRes.error,
    registrosSiembraRes.error,
    laboresRes.error,
    planesNutRes.error,
    alertasRes.error,
    aplicacionesRes.error,
    fertilizacionRes.error,
    analisisSueloRes.error,
    censosRes.error,
    cosechasRes.error,
    lotesFincaRes.error,
    cosechasFincaRes.error,
  ].filter(Boolean);
  if (errs.length) {
    return actionError(errs[0]!.message);
  }

  const fertilizacionInsumoIds = [
    ...new Set(
      (fertilizacionRes.data ?? [])
        .map((r) => (r as { catalogo_insumo_id?: string }).catalogo_insumo_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: fertilizacionInsumosRows } = fertilizacionInsumoIds.length
    ? await supabase
        .from("catalogo_items")
        .select("id, nombre")
        .in("id", fertilizacionInsumoIds)
    : { data: [] as { id: string; nombre: string }[] };
  const fertilizacionInsumoMap = new Map(
    (fertilizacionInsumosRows ?? []).map((i) => [i.id, i.nombre])
  );

  const catalogoIdsPlan = [
    ...new Set(
      (planesSiembraRes.data ?? [])
        .map((p) => (p as { catalogo_material_id?: string }).catalogo_material_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const germSelect =
    "id, fecha_tratamiento, temperatura_max_c, dias_tratamiento, notas, created_at, catalogo_material_id, catalogo_items ( nombre )";

  const germinacionesRes =
    catalogoIdsPlan.length > 0
      ? await supabase
          .from("registros_germinacion")
          .select(germSelect)
          .eq("finca_id", fincaId)
          .eq("is_voided", false)
          .or(`lote_id.eq.${lid},catalogo_material_id.in.(${catalogoIdsPlan.join(",")})`)
          .order("fecha_tratamiento", { ascending: false })
      : await supabase
          .from("registros_germinacion")
          .select(germSelect)
          .eq("lote_id", lid)
          .eq("is_voided", false)
          .order("fecha_tratamiento", { ascending: false });

  if (germinacionesRes.error) {
    return actionError(germinacionesRes.error.message);
  }

  const germRows = germinacionesRes.data ?? [];
  const germIds = germRows.map((g) => g.id);

  let evalRows: Array<{
    id: string;
    germinacion_id: string;
    concepto: string;
    pct_germinacion: string | number;
    total_inicial: number;
    unidades_germinadas: number;
    created_at: string;
  }> = [];

  if (germIds.length > 0) {
    const evaluacionesRes = await supabase
      .from("evaluaciones_vivero")
      .select(
        "id, germinacion_id, concepto, pct_germinacion, total_inicial, unidades_germinadas, created_at"
      )
      .in("germinacion_id", germIds)
      .eq("is_voided", false)
      .order("created_at", { ascending: false });
    if (evaluacionesRes.error) {
      return actionError(evaluacionesRes.error.message);
    }
    evalRows = evaluacionesRes.data ?? [];
  }

  const eventos: TimelineEvent[] = [];

  for (const ps of planesSiembraRes.data ?? []) {
    const mat = (ps as { catalogo_items?: { nombre?: string } | null }).catalogo_items?.nombre;
    const sortAt = ymdToSortIso(String(ps.fecha_proyectada));
    eventos.push({
      id: `plan-siembra:${ps.id}`,
      category: "material_plan",
      sortAt,
      displayDate: String(ps.fecha_proyectada),
      title: "Plan de siembra",
      subtitle: mat ? `Material: ${mat}` : null,
      metadata: {
        tipo: "plan_siembra",
        fechaProyectada: ps.fecha_proyectada,
        materialNombre: mat ?? null,
        confirmacionErosion: ps.confirmacion_erosion,
        notas: ps.notas,
        planId: ps.id,
      },
    });
  }

  for (const pt of preparacionesTerrenoRes.data ?? []) {
    const created = String(pt.created_at);
    const acts = (pt.actividades ?? []).join(", ");
    eventos.push({
      id: `preparacion-terreno:${pt.id}`,
      category: "material_plan",
      sortAt: created,
      displayDate: created.slice(0, 10),
      title: "Preparación de terreno",
      subtitle: `Pendiente ${pt.pendiente_final_pct}% · ${acts}`,
      metadata: {
        tipo: "preparacion_terreno",
        preparacionId: pt.id,
        pendienteFinalPct: Number(pt.pendiente_final_pct),
        actividades: pt.actividades,
        estado: pt.estado,
        notas: pt.notas,
      },
    });
  }

  for (const rs of registrosSiembraRes.data ?? []) {
    const mat = (rs as { catalogo_items?: { nombre?: string } | null }).catalogo_items
      ?.nombre;
    const fs = String(rs.fecha_siembra);
    eventos.push({
      id: `registro-siembra:${rs.id}`,
      category: "material_plan",
      sortAt: ymdToSortIso(fs),
      displayDate: fs,
      title: "Registro de siembra",
      subtitle: mat
        ? `${rs.cantidad_palmas} palmas · ${mat}`
        : `${rs.cantidad_palmas} palmas`,
      metadata: {
        tipo: "registro_siembra",
        registroSiembraId: rs.id,
        fechaSiembra: fs,
        cantidadPalmas: rs.cantidad_palmas,
        materialNombre: mat ?? null,
        notas: rs.notas,
      },
    });
  }

  for (const g of germRows) {
    const mat = (g as { catalogo_items?: { nombre?: string } | null }).catalogo_items?.nombre;
    const ft = String(g.fecha_tratamiento);
    eventos.push({
      id: `germinacion:${g.id}`,
      category: "vivero",
      sortAt: ymdToSortIso(ft),
      displayDate: ft,
      title: "Germinación / tratamiento térmico",
      subtitle: mat ? `Material: ${mat}` : null,
      metadata: {
        tipo: "registro_germinacion",
        germinacionId: g.id,
        materialNombre: mat ?? null,
        temperaturaMaxC: Number(g.temperatura_max_c),
        diasTratamiento: g.dias_tratamiento,
        notas: g.notas,
      },
    });
  }

  for (const ev of evalRows) {
    const created = String(ev.created_at);
    const conceptoLabel =
      ev.concepto === "apto_trasplante"
        ? "Apto para trasplante"
        : String(ev.concepto).replaceAll("_", " ");
    eventos.push({
      id: `eval-vivero:${ev.id}`,
      category: "vivero",
      sortAt: created,
      displayDate: created.slice(0, 10),
      title: `Evaluación vivero: ${conceptoLabel}`,
      subtitle: `${Number(ev.pct_germinacion).toFixed(1)}% germinación · ${ev.unidades_germinadas}/${ev.total_inicial} unidades`,
      metadata: {
        tipo: "evaluacion_vivero",
        evaluacionId: ev.id,
        germinacionId: ev.germinacion_id,
        concepto: ev.concepto,
        pctGerminacion: Number(ev.pct_germinacion),
        totalInicial: ev.total_inicial,
        unidadesGerminadas: ev.unidades_germinadas,
      },
    });
  }

  for (const lb of laboresRes.data ?? []) {
    const cat = (lb as { catalogo_items?: { nombre?: string } | null }).catalogo_items?.nombre;
    const fe = String(lb.fecha_ejecucion);
    const cantidad = (lb as { cantidad_ejecutada?: number | null }).cantidad_ejecutada;
    const unidad = (lb as { unidad_medida?: string | null }).unidad_medida;
    const avance =
      cantidad != null && unidad
        ? `${Number(cantidad)} ${unidad === "ha" ? "ha" : "palmas"}`
        : null;
    eventos.push({
      id: `labor:${lb.id}`,
      category: "labor",
      sortAt: ymdToSortIso(fe),
      displayDate: fe,
      title: cat ?? lb.tipo,
      subtitle: avance ?? (cat && cat !== lb.tipo ? lb.tipo : null),
      metadata: {
        tipo: "labor",
        tipoTexto: lb.tipo,
        catalogoNombre: cat ?? null,
        cantidadEjecutada: cantidad != null ? Number(cantidad) : null,
        unidadMedida: unidad ?? null,
        notas: lb.notas,
        laborId: lb.id,
      },
    });
  }

  for (const pn of planesNutRes.data ?? []) {
    const items = (pn as {
      planes_nutricion_items?: Array<{
        id: string;
        dosis_cantidad: string | number;
        dosis_unidad: string;
        frecuencia: string;
        fecha_objetivo: string | null;
        notas: string | null;
        catalogo_items?: { nombre?: string } | null;
      }>;
    }).planes_nutricion_items;

    for (const it of items ?? []) {
      const ins = it.catalogo_items?.nombre ?? "Insumo";
      const fd = it.fecha_objetivo ?? String(pn.created_at).slice(0, 10);
      eventos.push({
        id: `nutricion-item:${it.id}`,
        category: "nutricion",
        sortAt: it.fecha_objetivo ? ymdToSortIso(it.fecha_objetivo) : String(pn.created_at),
        displayDate: fd,
        title: `Programación nutrición: ${ins}`,
        subtitle: `Dosis ${it.dosis_cantidad} ${it.dosis_unidad} · ${it.frecuencia}`,
        metadata: {
          tipo: "plan_nutricion_item",
          planId: pn.id,
          itemId: it.id,
          planNombre: pn.nombre,
          dosisCantidad: it.dosis_cantidad,
          dosisUnidad: it.dosis_unidad,
          frecuencia: it.frecuencia,
          notasItem: it.notas,
          notasPlan: pn.notas,
        },
      });
    }

    const riegos = (pn as {
      planes_riego_items?: Array<{
        id: string;
        descripcion: string;
        proxima_fecha: string;
        intervalo_dias: number | null;
        volumen_o_tiempo: string | null;
        notas: string | null;
      }>;
    }).planes_riego_items;

    for (const ri of riegos ?? []) {
      const pf = String(ri.proxima_fecha);
      eventos.push({
        id: `riego-item:${ri.id}`,
        category: "nutricion",
        sortAt: ymdToSortIso(pf),
        displayDate: pf,
        title: `Programación riego: ${ri.descripcion}`,
        subtitle: ri.volumen_o_tiempo ?? null,
        metadata: {
          tipo: "plan_riego_item",
          planId: pn.id,
          itemId: ri.id,
          intervaloDias: ri.intervalo_dias,
          notas: ri.notas,
        },
      });
    }
  }

  for (const af of fertilizacionRes.data ?? []) {
    const fa = String(af.fecha_aplicacion);
    const dosisUnidad = String(af.dosis_unidad ?? "");
    const insumoId = (af as { catalogo_insumo_id?: string }).catalogo_insumo_id;
    const insNombre = insumoId ? fertilizacionInsumoMap.get(insumoId) : undefined;
    eventos.push({
      id: `fertilizacion:${af.id}`,
      category: "nutricion",
      sortAt: ymdToSortIso(fa),
      displayDate: fa,
      title: insNombre ? `Fertilización aplicada: ${insNombre}` : "Fertilización aplicada",
      subtitle: `Dosis ${af.cantidad_aplicada} ${dosisUnidad.replace("por_", "por ")} · plan ${af.dosis_programada}`,
      metadata: {
        tipo: "aplicacion_fertilizacion",
        aplicacionId: af.id,
        catalogoInsumoId: insumoId ?? null,
        cantidadAplicada: Number(af.cantidad_aplicada),
        dosisProgramada: Number(af.dosis_programada),
        dosisUnidad,
        desviacionPct: Number(af.desviacion_pct),
        metodoAplicacion: af.metodo_aplicacion,
        notas: af.notas,
      },
    });
  }

  for (const al of alertasRes.data ?? []) {
    const plaga = (al as { catalogo_items?: { nombre?: string } | null }).catalogo_items?.nombre;
    const created = String(al.created_at);
    eventos.push({
      id: `alerta:${al.id}`,
      category: "sanidad",
      sortAt: created,
      displayDate: created.slice(0, 10),
      title: plaga ? `Alerta fitosanitaria: ${plaga}` : "Alerta fitosanitaria",
      subtitle: al.descripcion?.slice(0, 120) ?? null,
      metadata: {
        tipo: "alerta_fitosanitaria",
        severidad: al.severidad,
        descripcion: al.descripcion,
        validacionEstado: al.validacion_estado,
        validacionDiagnostico: al.validacion_diagnostico,
        alertaId: al.id,
      },
    });
  }

  for (const cs of censosRes.data ?? []) {
    const amenaza = (cs as { catalogo_items?: { nombre?: string } | null }).catalogo_items
      ?.nombre;
    const fa = String(cs.fecha_censo);
    const pct = Number(cs.incidencia_pct);
    eventos.push({
      id: `censo:${cs.id}`,
      category: "sanidad",
      sortAt: ymdToSortIso(fa),
      displayDate: fa,
      title: amenaza ? `Censo sanitario: ${amenaza}` : "Censo sanitario",
      subtitle: `${pct}% incidencia (${cs.palmas_afectadas}/${cs.palmas_inspeccionadas} palmas)`,
      metadata: {
        tipo: "censo_sanitario",
        censoId: cs.id,
        incidenciaPct: pct,
        palmasInspeccionadas: cs.palmas_inspeccionadas,
        palmasAfectadas: cs.palmas_afectadas,
        superaUmbral: cs.supera_umbral,
        notas: cs.notas,
      },
    });
  }

  for (const as of analisisSueloRes.data ?? []) {
    const fa = String(as.fecha_analisis);
    const ph = as.ph != null ? Number(as.ph) : null;
    const hum = as.humedad_pct != null ? Number(as.humedad_pct) : null;
    const parts: string[] = [];
    if (ph != null && Number.isFinite(ph)) parts.push(`pH ${ph}`);
    if (hum != null && Number.isFinite(hum)) parts.push(`Humedad ${hum}%`);
    eventos.push({
      id: `analisis-suelo:${as.id}`,
      category: "suelo",
      sortAt: ymdToSortIso(fa),
      displayDate: fa,
      title: "Análisis de suelo",
      subtitle: parts.length ? parts.join(" · ") : null,
      metadata: {
        tipo: "analisis_suelo",
        analisisId: as.id,
        ph,
        humedadPct: hum,
        compactacion: as.compactacion,
        fertilidadCompleta: as.fertilidad_completa,
        textura: as.textura,
        aluminio: as.aluminio != null ? Number(as.aluminio) : null,
        cic: as.cic != null ? Number(as.cic) : null,
        materiaOrganicaPct:
          as.materia_organica_pct != null ? Number(as.materia_organica_pct) : null,
        drenajeCampo: as.drenaje_campo,
        notas: as.notas,
        tieneArchivo: Boolean(as.archivo_url),
      },
    });
  }

  for (const ap of aplicacionesRes.data ?? []) {
    const prod = (ap as { catalogo_items?: { nombre?: string } | null }).catalogo_items?.nombre;
    const fa = String(ap.fecha_aplicacion);
    eventos.push({
      id: `aplicacion-fito:${ap.id}`,
      category: "sanidad",
      sortAt: ymdToSortIso(fa),
      displayDate: fa,
      title: prod ? `Aplicación fitosanitaria: ${prod}` : "Aplicación fitosanitaria",
      subtitle: `${ap.cantidad_aplicada} ${ap.unidad_medida ?? ""}`.trim(),
      metadata: {
        tipo: "aplicacion_fitosanitaria",
        cantidad: ap.cantidad_aplicada,
        unidad: ap.unidad_medida,
        notas: ap.notas,
        aplicacionId: ap.id,
      },
    });
  }

  const cosechasOrdenadas = [...(cosechasRes.data ?? [])].sort((a, b) => {
    const da = new Date(`${a.fecha}T12:00:00.000Z`).getTime();
    const db = new Date(`${b.fecha}T12:00:00.000Z`).getTime();
    return db - da;
  });

  for (const c of cosechasOrdenadas) {
    const pesoKg = Number(c.peso_kg);
    const r = rendimientoTonHa(pesoKg, areaHa);
    const fe = String(c.fecha);
    eventos.push({
      id: `cosecha:${c.id}`,
      category: "cosecha",
      sortAt: ymdToSortIso(fe),
      displayDate: fe,
      title: "Cosecha RFF",
      subtitle: `${(pesoKg / 1000).toFixed(3)} t · ${c.conteo_racimos} racimos · ${r.toFixed(3)} t/ha`,
      metadata: {
        tipo: "cosecha_rff",
        pesoKg,
        conteoRacimos: c.conteo_racimos,
        rendimientoTonHa: Math.round(r * 1000) / 1000,
        observaciones: c.observaciones_calidad,
        cosechaId: c.id,
      },
    });
  }

  eventos.sort(compareEvents);

  const conteoPorCategoria = emptyConteo();
  for (const e of eventos) {
    conteoPorCategoria[e.category] += 1;
  }

  let ultimaCosecha: TrazabilidadResumen["ultimaCosecha"] = null;
  if (cosechasOrdenadas[0]) {
    const c0 = cosechasOrdenadas[0];
    const peso = Number(c0.peso_kg);
    ultimaCosecha = {
      fecha: String(c0.fecha),
      rendimientoTonHa: Math.round(rendimientoTonHa(peso, areaHa) * 1000) / 1000,
      pesoKg: peso,
      conteoRacimos: c0.conteo_racimos,
    };
  }

  const areaByLote = new Map<string, number>();
  for (const row of lotesFincaRes.data ?? []) {
    const a = Number(row.area_ha);
    if (Number.isFinite(a) && a > 0) {
      areaByLote.set(row.id, a);
    }
  }

  const rendimientosFinca: number[] = [];
  for (const row of cosechasFincaRes.data ?? []) {
    const a = areaByLote.get(row.lote_id);
    const p = Number(row.peso_kg);
    if (a !== undefined && Number.isFinite(p)) {
      rendimientosFinca.push(rendimientoTonHa(p, a));
    }
  }
  const rendimientoPromedioFinca =
    rendimientosFinca.length > 0
      ? Math.round(
          (rendimientosFinca.reduce((s, x) => s + x, 0) / rendimientosFinca.length) * 1000
        ) / 1000
      : null;

  let tendenciaTexto: string | null = null;
  if (cosechasOrdenadas.length >= 2) {
    const antigua = cosechasOrdenadas[cosechasOrdenadas.length - 1];
    const nueva = cosechasOrdenadas[0];
    const rOld = rendimientoTonHa(Number(antigua.peso_kg), areaHa);
    const rNew = rendimientoTonHa(Number(nueva.peso_kg), areaHa);
    const delta = rNew - rOld;
    if (delta > 0.05) {
      tendenciaTexto = `Entre la cosecha del ${antigua.fecha} y la del ${nueva.fecha}, el rendimiento subió aprox. ${(delta).toFixed(2)} t/ha.`;
    } else if (delta < -0.05) {
      tendenciaTexto = `Entre la cosecha del ${antigua.fecha} y la del ${nueva.fecha}, el rendimiento bajó aprox. ${Math.abs(delta).toFixed(2)} t/ha. Revise labores y sanidad en el periodo.`;
    } else {
      tendenciaTexto = "El rendimiento entre la primera y la última cosecha listada se mantiene estable.";
    }
  }

  const sevRank: Record<string, number> = {
    critica: 4,
    alta: 3,
    media: 2,
    baja: 1,
  };
  let ultimaAlertaFuerte: TrazabilidadResumen["ultimaAlertaFuerte"] = null;
  for (const al of alertasRes.data ?? []) {
    const rank = sevRank[String(al.severidad)] ?? 0;
    if (rank >= 3) {
      const plaga = (al as { catalogo_items?: { nombre?: string } | null }).catalogo_items?.nombre;
      ultimaAlertaFuerte = {
        sortAt: String(al.created_at),
        severidad: String(al.severidad),
        title: plaga ? `Alerta: ${plaga}` : "Alerta fitosanitaria",
      };
      break;
    }
  }
  if (!ultimaAlertaFuerte && (alertasRes.data ?? []).length) {
    const al = (alertasRes.data ?? [])[0];
    const plaga = (al as { catalogo_items?: { nombre?: string } | null }).catalogo_items?.nombre;
    ultimaAlertaFuerte = {
      sortAt: String(al.created_at),
      severidad: String(al.severidad),
      title: plaga ? `Alerta: ${plaga}` : "Alerta fitosanitaria",
    };
  }

  const lote: TrazabilidadLoteCabecera = {
    id: loteRow.id,
    codigo: loteRow.codigo,
    finca_id: loteRow.finca_id,
    area_ha: areaHa,
    activo: loteRow.activo,
    estado_cultivo: String(loteRow.estado_cultivo),
    material_genetico: loteRow.material_genetico,
    anio_siembra: loteRow.anio_siembra,
  };

  const resumen: TrazabilidadResumen = {
    materialDeclarado: loteRow.material_genetico,
    estadoCultivo: String(loteRow.estado_cultivo),
    ultimaCosecha,
    rendimientoPromedioFinca,
    cosechasEnLote: cosechasOrdenadas.length,
    tendenciaTexto,
    ultimaAlertaFuerte,
    conteoPorCategoria,
  };

  if (recordAudit) {
    await registrarEventoFinca({
      fincaId,
      actionKey: "trazabilidad.consulta",
      titulo: "Consulta trazabilidad técnica",
      detalle: {
        loteId: lote.id,
        loteCodigo: lote.codigo,
        numEventos: eventos.length,
      },
    });
  }

  return actionOk({ lote, eventos, resumen });
}
