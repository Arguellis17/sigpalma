"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import type { FilaLiquidacion } from "@/lib/jornales";
import { isUniqueViolation } from "@/lib/postgres-errors";
import {
  anularLiquidacionSchema,
  anularTarifaSchema,
  guardarTarifaSchema,
  periodoLiquidacionSchema,
} from "@/lib/validations/jornales";
import { registrarEventoFinca } from "./audit";
import { actionError, actionOk, type ActionResult } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TarifaRow = {
  id: string;
  catalogo_item_id: string;
  labor_nombre: string;
  unidad_medida: string;
  valor_unitario: number;
  vigente_desde: string;
};

export type LiquidacionRow = {
  id: string;
  consecutivo: number;
  periodo_desde: string;
  periodo_hasta: string;
  total: number;
  trabajadores: number;
  labores: number;
  is_voided: boolean;
  motivo_anulacion: string | null;
  created_at: string;
};

export type LiquidacionCompleta = LiquidacionRow & { finca_id: string; finca_nombre: string; filas: FilaLiquidacion[] };

const RUTA = "/admin/jornales";

function mensajes(parsed: { error: { issues: { message: string }[] } }) {
  return parsed.error.issues.map((i) => i.message).join("; ");
}

/** Sesión de administrador con finca: quien liquida los jornales. */
async function sesionAdmin(): Promise<ActionResult<{ fincaId: string; userId: string; supabase: Supabase }>> {
  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }
  if (session.profile.role !== "admin" || !session.profile.finca_id) {
    return actionError("Solo el administrador de la finca puede liquidar jornales.");
  }
  return actionOk({ fincaId: session.profile.finca_id, userId: session.user.id, supabase: await createClient() });
}

export async function listarTarifas(): Promise<ActionResult<TarifaRow[]>> {
  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;
  const { data, error } = await supabase
    .from("tarifas_labor")
    .select("id, catalogo_item_id, unidad_medida, valor_unitario, vigente_desde, catalogo_items ( nombre )")
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("vigente_desde", { ascending: false });
  if (error) return actionError(error.message);
  const filas = (data ?? []) as unknown as (Omit<TarifaRow, "labor_nombre"> & { catalogo_items: { nombre: string } | null })[];
  return actionOk(
    filas
      .map(({ catalogo_items, ...f }) => ({ ...f, valor_unitario: Number(f.valor_unitario), labor_nombre: catalogo_items?.nombre ?? "—" }))
      .sort((a, b) => a.labor_nombre.localeCompare(b.labor_nombre, "es"))
  );
}

export async function guardarTarifa(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = guardarTarifaSchema.safeParse(raw);
  if (!parsed.success) return actionError(mensajes(parsed));
  const input = parsed.data;

  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId, userId } = sesion.data;

  const { data: labor } = await supabase
    .from("catalogo_items")
    .select("nombre, categoria")
    .eq("id", input.catalogo_item_id)
    .maybeSingle();
  if (!labor || labor.categoria !== "labor") return actionError("Seleccione una labor del catálogo.");

  const { data, error } = await supabase
    .from("tarifas_labor")
    .insert({ ...input, finca_id: fincaId, created_by: userId })
    .select("id")
    .single();
  if (error) {
    return actionError(
      isUniqueViolation(error) ? "Ya hay una tarifa para esta labor y unidad en esa fecha. Anúlela primero." : error.message
    );
  }

  await registrarEventoFinca({
    fincaId,
    actionKey: "jornales.tarifa_guardar",
    titulo: "Tarifa de labor registrada",
    detalle: { tarifaId: data.id, tipoLabor: labor.nombre, unidadMedida: input.unidad_medida, valorUnitario: input.valor_unitario, vigenteDesde: input.vigente_desde },
  });
  revalidatePath(RUTA);
  return actionOk({ id: data.id });
}

export async function anularTarifa(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = anularTarifaSchema.safeParse(raw);
  if (!parsed.success) return actionError(mensajes(parsed));
  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;

  const { error, count } = await supabase
    .from("tarifas_labor")
    .update({ is_voided: true }, { count: "exact" })
    .eq("id", parsed.data.id)
    .eq("finca_id", fincaId)
    .eq("is_voided", false);
  if (error) return actionError(error.message);
  if (!count) return actionError("Tarifa no encontrada.");

  await registrarEventoFinca({
    fincaId,
    actionKey: "jornales.tarifa_anular",
    titulo: "Tarifa de labor anulada",
    detalle: { tarifaId: parsed.data.id },
  });
  revalidatePath(RUTA);
  return actionOk({ id: parsed.data.id });
}

/** Vista previa: labores ejecutadas del periodo que aún no están en una liquidación vigente. */
export async function calcularLiquidacion(raw: unknown): Promise<ActionResult<FilaLiquidacion[]>> {
  const parsed = periodoLiquidacionSchema.safeParse(raw);
  if (!parsed.success) return actionError(mensajes(parsed));
  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;

  const { data, error } = await supabase.rpc("calcular_liquidacion_jornales", {
    p_finca: fincaId,
    p_desde: parsed.data.desde,
    p_hasta: parsed.data.hasta,
  });
  if (error) return actionError(error.message);
  return actionOk(
    (data ?? []).map((f) => ({
      ...f,
      cantidad: Number(f.cantidad),
      valor_unitario: f.valor_unitario == null ? null : Number(f.valor_unitario),
      subtotal: f.subtotal == null ? null : Number(f.subtotal),
    }))
  );
}

export async function cerrarLiquidacion(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = periodoLiquidacionSchema.safeParse(raw);
  if (!parsed.success) return actionError(mensajes(parsed));
  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;

  const { data: id, error } = await supabase.rpc("cerrar_liquidacion_jornales", {
    p_finca: fincaId,
    p_desde: parsed.data.desde,
    p_hasta: parsed.data.hasta,
  });
  if (error || !id) return actionError(error?.message ?? "No se pudo cerrar la liquidación.");

  const { data: liq } = await supabase
    .from("liquidaciones_jornales")
    .select("consecutivo, total, trabajadores, labores")
    .eq("id", id)
    .maybeSingle();
  await registrarEventoFinca({
    fincaId,
    actionKey: "jornales.liquidacion_cerrar",
    titulo: "Liquidación de jornales cerrada",
    detalle: { liquidacionId: id, periodoDesde: parsed.data.desde, periodoHasta: parsed.data.hasta, ...liq },
  });
  revalidatePath(RUTA);
  return actionOk({ id });
}

export async function anularLiquidacion(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = anularLiquidacionSchema.safeParse(raw);
  if (!parsed.success) return actionError(mensajes(parsed));
  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;

  const { error } = await supabase.rpc("anular_liquidacion_jornales", {
    p_id: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return actionError(error.message);

  await registrarEventoFinca({
    fincaId,
    actionKey: "jornales.liquidacion_anular",
    titulo: "Liquidación de jornales anulada",
    detalle: { liquidacionId: parsed.data.id, motivo: parsed.data.motivo },
  });
  revalidatePath(RUTA);
  return actionOk({ id: parsed.data.id });
}

export async function listarLiquidaciones(): Promise<ActionResult<LiquidacionRow[]>> {
  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;
  const { data, error } = await supabase
    .from("liquidaciones_jornales")
    .select("id, consecutivo, periodo_desde, periodo_hasta, total, trabajadores, labores, is_voided, motivo_anulacion, created_at")
    .eq("finca_id", fincaId)
    .order("consecutivo", { ascending: false });
  if (error) return actionError(error.message);
  return actionOk((data ?? []).map((l) => ({ ...l, total: Number(l.total) })));
}

/** Liquidación con su detalle guardado (no se recalcula): para consultar y exportar. */
export async function obtenerLiquidacion(id: string): Promise<ActionResult<LiquidacionCompleta>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return actionError("Liquidación no válida.");
  const sesion = await sesionAdmin();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;

  const { data: liq, error } = await supabase
    .from("liquidaciones_jornales")
    .select("id, consecutivo, finca_id, periodo_desde, periodo_hasta, total, trabajadores, labores, is_voided, motivo_anulacion, created_at, fincas ( nombre )")
    .eq("id", id)
    .eq("finca_id", fincaId)
    .maybeSingle();
  if (error) return actionError(error.message);
  if (!liq) return actionError("Liquidación no encontrada.");

  const { data: detalle, error: de } = await supabase
    .from("liquidaciones_jornales_detalle")
    .select("labor_id, trabajador_id, trabajador_nombre, trabajador_documento, labor_nombre, lote_codigo, fecha, cantidad, unidad_medida, valor_unitario, subtotal")
    .eq("liquidacion_id", id)
    .order("trabajador_nombre")
    .order("fecha");
  if (de) return actionError(de.message);

  const { fincas, ...resto } = liq as unknown as Omit<LiquidacionCompleta, "finca_nombre" | "filas"> & { fincas: { nombre: string } | null };
  return actionOk({
    ...resto,
    total: Number(resto.total),
    finca_nombre: fincas?.nombre ?? "",
    filas: (detalle ?? []).map((f) => ({
      ...f,
      cantidad: Number(f.cantidad),
      valor_unitario: Number(f.valor_unitario),
      subtotal: Number(f.subtotal),
    })),
  });
}

export async function registrarExportacionLiquidacion(id: string, fincaId: string, consecutivo: number) {
  await registrarEventoFinca({
    fincaId,
    actionKey: "jornales.liquidacion_exportar",
    titulo: "Exportación Excel de liquidación de jornales",
    detalle: { liquidacionId: id, consecutivo },
  });
}
