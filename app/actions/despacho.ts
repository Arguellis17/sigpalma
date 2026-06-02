"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, hasRole, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  advertenciaSobrecarga,
  calcularTotalesRemision,
  generarNumeroRemision,
  validarMismaFechaCosechas,
  validarPlacaVehiculo,
} from "@/lib/despacho-validacion";
import { renderRemisionPdfBuffer } from "@/lib/pdf/render-remision-pdf";
import type { RemisionPdfData } from "@/lib/pdf/remision-pdf-types";
import { crearRemisionDespachoSchema } from "@/lib/validations/despacho";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export type CosechaDisponibleDespachoRow = {
  id: string;
  lote_id: string;
  lote_codigo: string;
  fecha: string;
  peso_kg: number;
  conteo_racimos: number;
};

export type RemisionListRow = {
  id: string;
  numero_remision: string;
  fecha_despacho: string;
  hora_salida: string;
  placa_vehiculo: string;
  conductor_identificacion: string;
  conductor_nombre: string | null;
  peso_total_kg: number;
  total_racimos: number;
  destino: string | null;
  created_at: string;
};

export type RemisionDetallePayload = RemisionPdfData & { id: string; finca_id: string };

export async function getCosechasDisponiblesDespacho(
  fincaId: string,
  fecha?: string
): Promise<ActionResult<CosechaDisponibleDespachoRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  let q = supabase
    .from("cosechas_rff")
    .select("id, lote_id, fecha, peso_kg, conteo_racimos")
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .eq("estado_acopio", "en_centro_acopio")
    .is("remision_id", null)
    .order("fecha", { ascending: false });

  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    q = q.eq("fecha", fecha);
  }

  const { data, error } = await q;
  if (error) return actionError(error.message);

  const rows = data ?? [];
  const loteIds = [...new Set(rows.map((r) => r.lote_id))];
  const { data: lotes } = loteIds.length
    ? await supabase.from("lotes").select("id, codigo").in("id", loteIds)
    : { data: [] as { id: string; codigo: string }[] };

  const loteMap = new Map((lotes ?? []).map((l) => [l.id, l.codigo]));

  return actionOk(
    rows.map((r) => ({
      id: r.id,
      lote_id: r.lote_id,
      lote_codigo: loteMap.get(r.lote_id) ?? "—",
      fecha: r.fecha,
      peso_kg: Number(r.peso_kg),
      conteo_racimos: r.conteo_racimos,
    }))
  );
}

export async function getRemisionesPorFinca(
  fincaId: string
): Promise<ActionResult<RemisionListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("remisiones_despacho")
    .select(
      "id, numero_remision, fecha_despacho, hora_salida, placa_vehiculo, conductor_identificacion, conductor_nombre, peso_total_kg, total_racimos, destino, created_at"
    )
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .order("hora_salida", { ascending: false })
    .limit(200);

  if (error) return actionError(error.message);

  return actionOk(
    (data ?? []).map((r) => ({
      id: r.id,
      numero_remision: r.numero_remision,
      fecha_despacho: r.fecha_despacho,
      hora_salida: r.hora_salida,
      placa_vehiculo: r.placa_vehiculo,
      conductor_identificacion: r.conductor_identificacion,
      conductor_nombre: r.conductor_nombre,
      peso_total_kg: Number(r.peso_total_kg),
      total_racimos: r.total_racimos,
      destino: r.destino,
      created_at: r.created_at,
    }))
  );
}

async function loadRemisionPdfData(
  remisionId: string
): Promise<ActionResult<RemisionDetallePayload>> {
  const supabase = await createClient();
  const { data: rem, error: re } = await supabase
    .from("remisiones_despacho")
    .select(
      "id, finca_id, numero_remision, fecha_despacho, hora_salida, placa_vehiculo, conductor_identificacion, conductor_nombre, peso_total_kg, total_racimos, destino, latitud, longitud, is_voided"
    )
    .eq("id", remisionId)
    .maybeSingle();

  if (re || !rem || rem.is_voided) {
    return actionError(re?.message ?? "Remisión no encontrada.");
  }

  const { data: finca } = await supabase
    .from("fincas")
    .select("nombre")
    .eq("id", rem.finca_id)
    .maybeSingle();

  const { data: cosechas, error: ce } = await supabase
    .from("cosechas_rff")
    .select("lote_id, fecha, peso_kg, conteo_racimos")
    .eq("remision_id", remisionId)
    .eq("is_voided", false);

  if (ce) return actionError(ce.message);

  const loteIds = [...new Set((cosechas ?? []).map((c) => c.lote_id))];
  const { data: lotes } = loteIds.length
    ? await supabase.from("lotes").select("id, codigo").in("id", loteIds)
    : { data: [] as { id: string; codigo: string }[] };

  const loteMap = new Map((lotes ?? []).map((l) => [l.id, l.codigo]));

  const horaSalida = new Date(rem.hora_salida);
  const horaStr = Number.isNaN(horaSalida.getTime())
    ? rem.hora_salida
    : horaSalida.toLocaleString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  return actionOk({
    id: rem.id,
    finca_id: rem.finca_id,
    numero_remision: rem.numero_remision,
    finca_nombre: finca?.nombre ?? "Finca",
    fecha_despacho: rem.fecha_despacho,
    hora_salida: horaStr,
    placa_vehiculo: rem.placa_vehiculo,
    conductor_identificacion: rem.conductor_identificacion,
    conductor_nombre: rem.conductor_nombre,
    peso_total_kg: Number(rem.peso_total_kg),
    total_racimos: rem.total_racimos,
    destino: rem.destino,
    latitud: rem.latitud != null ? Number(rem.latitud) : null,
    longitud: rem.longitud != null ? Number(rem.longitud) : null,
    lineas: (cosechas ?? []).map((c) => ({
      lote_codigo: loteMap.get(c.lote_id) ?? "—",
      fecha_cosecha: c.fecha,
      peso_kg: Number(c.peso_kg),
      conteo_racimos: c.conteo_racimos,
    })),
  });
}

export async function getRemisionDetalle(
  remisionId: string
): Promise<ActionResult<RemisionDetallePayload>> {
  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }

  const res = await loadRemisionPdfData(remisionId);
  if (!res.success) return res;

  const { profile } = session;
  if (
    !isSuperAdmin(profile) &&
    profile.finca_id !== res.data.finca_id
  ) {
    return actionError("No tiene acceso a esta remisión.");
  }

  return res;
}

export type CrearRemisionResult = {
  id: string;
  numero_remision: string;
  pdf_download_url: string;
};

export async function crearRemisionDespacho(
  raw: unknown
): Promise<ActionResult<CrearRemisionResult>> {
  const parsed = crearRemisionDespachoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user) return actionError("Sesión no válida.");
  const profile = session.profile;
  if (!hasRole(profile, ["operario", "agronomo"])) {
    return actionError("Solo operario o agrónomo pueden crear remisiones.");
  }
  if (!profile?.finca_id && profile?.role !== "superadmin") {
    return actionError("Su cuenta no tiene finca asignada.");
  }
  if (profile?.finca_id && profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const placaRes = validarPlacaVehiculo(input.placa_vehiculo);
  if (!placaRes.ok) return actionError(placaRes.error);

  const supabase = await createClient();

  const { data: cosechas, error: ce } = await supabase
    .from("cosechas_rff")
    .select("id, fecha, peso_kg, conteo_racimos")
    .in("id", input.cosecha_ids)
    .eq("finca_id", input.finca_id)
    .eq("is_voided", false)
    .eq("estado_acopio", "en_centro_acopio")
    .is("remision_id", null);

  if (ce) return actionError(ce.message);
  if (!cosechas?.length || cosechas.length !== input.cosecha_ids.length) {
    return actionError("Una o más cosechas no están disponibles para despacho.");
  }

  const cosechaRows = cosechas.map((c) => ({
    id: c.id,
    fecha: c.fecha,
    peso_kg: Number(c.peso_kg),
    conteo_racimos: c.conteo_racimos,
  }));

  const fechaCheck = validarMismaFechaCosechas(cosechaRows);
  if (!fechaCheck.ok) return actionError(fechaCheck.error);

  const totales = calcularTotalesRemision(cosechaRows);
  const adv = advertenciaSobrecarga(
    totales.peso_total_kg,
    input.capacidad_vehiculo_kg
  );
  if (adv && !input.confirmar_sobrecarga) {
    return actionError(adv);
  }

  const year = new Date(fechaCheck.fecha).getFullYear();
  const { count } = await supabase
    .from("remisiones_despacho")
    .select("id", { count: "exact", head: true })
    .eq("finca_id", input.finca_id)
    .gte("fecha_despacho", `${year}-01-01`)
    .lte("fecha_despacho", `${year}-12-31`);

  const numero = await generarNumeroRemision(
    input.finca_id,
    year,
    count ?? 0
  );

  const { data: remisionId, error: rpcErr } = await supabase.rpc(
    "crear_remision_despacho",
    {
      p_finca_id: input.finca_id,
      p_numero_remision: numero,
      p_fecha_despacho: fechaCheck.fecha,
      p_placa: placaRes.placa,
      p_conductor_id: input.conductor_identificacion.trim(),
      p_conductor_nombre: input.conductor_nombre?.trim() || null,
      p_peso_total: totales.peso_total_kg,
      p_total_racimos: totales.total_racimos,
      p_capacidad: input.capacidad_vehiculo_kg ?? null,
      p_lat: input.latitud ?? null,
      p_lng: input.longitud ?? null,
      p_destino: input.destino?.trim() || null,
      p_created_by: session.user.id,
      p_source: input.source,
      p_cosecha_ids: input.cosecha_ids,
    }
  );

  if (rpcErr || !remisionId) {
    return actionError(rpcErr?.message ?? "No se pudo crear la remisión.");
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "despacho.remision_crear",
    titulo: "Remisión de despacho RFF",
    detalle: {
      remisionId,
      numeroRemision: numero,
      fechaDespacho: fechaCheck.fecha,
      placa: placaRes.placa,
      pesoTotalKg: totales.peso_total_kg,
      totalRacimos: totales.total_racimos,
      cosechaIds: input.cosecha_ids,
    },
  });

  return actionOk({
    id: remisionId as string,
    numero_remision: numero,
    pdf_download_url: `/api/v1/remisiones/${remisionId}/pdf`,
  });
}

export async function generarRemisionPdfBase64(
  remisionId: string
): Promise<ActionResult<{ pdf_base64: string; filename: string }>> {
  const det = await getRemisionDetalle(remisionId);
  if (!det.success) return det;

  const buf = await renderRemisionPdfBuffer(det.data);
  return actionOk({
    pdf_base64: buf.toString("base64"),
    filename: `${det.data.numero_remision}.pdf`,
  });
}
