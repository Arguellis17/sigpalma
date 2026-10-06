"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, hasRole } from "@/lib/auth/session-profile";
import {
  agregarCosechasPorLote,
  agregarCosechasPorMes,
  agregarResumenFinca,
  type CosechaAgregadaRow,
  type MesProductividadRow,
  type ResumenFincaProductividad,
} from "@/lib/productividad";
import {
  reporteProductividadSchema,
  type ReporteProductividadInput,
} from "@/lib/validations/productividad";
import type { FincaAuditActionKey } from "@/lib/audit/finca-audit";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export type ReporteProductividadPayload = {
  finca_id: string;
  finca_nombre: string;
  fecha_desde: string;
  fecha_hasta: string;
  filas: CosechaAgregadaRow[];
  resumen: ResumenFincaProductividad;
  mensual: MesProductividadRow[];
  /** Cosechas individuales de los lotes incluidos, orden cronológico (detalle exportable). */
  registros: CosechaDetalleRow[];
};

export type CosechaDetalleRow = {
  fecha: string;
  lote_codigo: string;
  peso_kg: number;
  conteo_racimos: number;
};

type BuildOpts = {
  auditAction?: FincaAuditActionKey;
  auditTitulo?: string;
  formato?: "pdf" | "xlsx";
};

export async function buildReporteProductividadPayload(
  input: ReporteProductividadInput,
  opts?: BuildOpts
): Promise<ActionResult<ReporteProductividadPayload>> {
  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  const { profile } = session;

  if (!hasRole(profile, ["admin", "agronomo", "superadmin"])) {
    return actionError("No tiene permiso para consultar este reporte.");
  }

  if (profile.role === "admin" || profile.role === "agronomo") {
    if (!profile.finca_id) {
      return actionError("Su cuenta no tiene finca asignada.");
    }
    if (profile.finca_id !== input.finca_id) {
      return actionError("Solo puede consultar la productividad de su finca asignada.");
    }
  }

  const supabase = await createClient();

  const { data: finca, error: fincaErr } = await supabase
    .from("fincas")
    .select("id, nombre")
    .eq("id", input.finca_id)
    .maybeSingle();

  if (fincaErr) {
    return actionError(fincaErr.message);
  }
  if (!finca) {
    return actionError("Finca no encontrada.");
  }

  let cosechasQuery = supabase
    .from("cosechas_rff")
    .select("lote_id, fecha, peso_kg, conteo_racimos")
    .eq("finca_id", input.finca_id)
    .eq("is_voided", false)
    .gte("fecha", input.fecha_desde)
    .lte("fecha", input.fecha_hasta);

  if (input.lote_ids?.length) {
    cosechasQuery = cosechasQuery.in("lote_id", input.lote_ids);
  }

  const { data: cosechas, error: cErr } = await cosechasQuery;
  if (cErr) {
    return actionError(cErr.message);
  }

  const registros = (cosechas ?? []).map((c) => ({
    lote_id: c.lote_id,
    fecha: String(c.fecha),
    peso_kg: Number(c.peso_kg),
    conteo_racimos: c.conteo_racimos,
  }));

  const loteIds = [...new Set(registros.map((r) => r.lote_id))];
  const { data: lotesRows, error: lErr } = loteIds.length
    ? await supabase
        .from("lotes")
        .select("id, codigo, area_ha")
        .in("id", loteIds)
    : { data: [], error: null };

  if (lErr) {
    return actionError(lErr.message);
  }

  const lotes = (lotesRows ?? []).map((l) => ({
    id: l.id,
    codigo: l.codigo,
    area_ha: Number(l.area_ha),
  }));

  const filas = agregarCosechasPorLote(registros, lotes);
  const resumen = agregarResumenFinca(filas);
  const mensual = agregarCosechasPorMes(registros, filas);
  const codigoPorLote = new Map(filas.map((f) => [f.lote_id, f.lote_codigo]));
  const detalle: CosechaDetalleRow[] = registros
    .filter((r) => codigoPorLote.has(r.lote_id))
    .map((r) => ({
      fecha: r.fecha,
      lote_codigo: codigoPorLote.get(r.lote_id)!,
      peso_kg: r.peso_kg,
      conteo_racimos: r.conteo_racimos,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.lote_codigo.localeCompare(b.lote_codigo));

  const auditAction = opts?.auditAction ?? "reporte.productividad_consultar";
  const auditTitulo =
    opts?.auditTitulo ??
    (auditAction === "reporte.productividad_exportar"
      ? "Exportación reporte de productividad"
      : "Consulta reporte de productividad");

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: auditAction,
    titulo: auditTitulo,
    detalle: {
      fechaDesde: input.fecha_desde,
      fechaHasta: input.fecha_hasta,
      loteIds: input.lote_ids ?? null,
      totalRegistros: resumen.total_registros,
      tonHaPonderado: resumen.ton_ha_ponderado,
      formato:
        auditAction === "reporte.productividad_exportar" ? (opts?.formato ?? "pdf") : "pantalla",
    },
  });

  return actionOk({
    finca_id: finca.id,
    finca_nombre: finca.nombre,
    fecha_desde: input.fecha_desde,
    fecha_hasta: input.fecha_hasta,
    filas,
    resumen,
    mensual,
    registros: detalle,
  });
}

export async function consultarReporteProductividad(
  raw: unknown
): Promise<ActionResult<ReporteProductividadPayload>> {
  const parsed = reporteProductividadSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  return buildReporteProductividadPayload(parsed.data);
}
