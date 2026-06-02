"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  filasIncluyenLaborCosechaPendiente,
  loteAptoParaCosecha,
  mensajePesoInusual,
  pesoEsInusual,
} from "@/lib/cosecha-validacion";
import { rendimientoTonHa } from "@/lib/productividad";
import {
  anularRegistroCampoSchema,
  reportarCosechaSchema,
  type ReportarCosechaInput,
} from "@/lib/validations/operativo";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export type ReportarCosechaResult = {
  id: string;
  rendimiento_ton_ha: number;
};

export async function reportarCosecha(
  raw: unknown
): Promise<ActionResult<ReportarCosechaResult>> {
  const parsed = reportarCosechaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ReportarCosechaInput = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }

  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select("id, area_ha, codigo, activo, estado_cultivo, anio_siembra")
    .eq("id", input.lote_id)
    .eq("finca_id", input.finca_id)
    .maybeSingle();

  if (loteErr) {
    return actionError(loteErr.message);
  }
  if (!lote) {
    return actionError("Lote no encontrado para la finca indicada.");
  }

  const aptitud = loteAptoParaCosecha(
    {
      activo: lote.activo,
      estado_cultivo: lote.estado_cultivo,
      anio_siembra: lote.anio_siembra,
    },
    input.fecha
  );
  if (!aptitud.ok) {
    return actionError(aptitud.error);
  }

  const { data: laboresPendientes, error: labErr } = await supabase
    .from("labores_agronomicas")
    .select("id, catalogo_items ( nombre )")
    .eq("finca_id", input.finca_id)
    .eq("lote_id", input.lote_id)
    .eq("is_voided", false)
    .is("cantidad_ejecutada", null)
    .not("catalogo_item_id", "is", null)
    .lte("fecha_ejecucion", input.fecha);

  if (labErr) {
    return actionError(labErr.message);
  }
  if (
    !filasIncluyenLaborCosechaPendiente(
      (laboresPendientes ?? []) as { catalogo_items: { nombre: string } | null }[]
    )
  ) {
    return actionError(
      "No hay una labor «Cosecha RFF» programada y pendiente para este lote. Solicite al agrónomo programarla en la agenda (HU11)."
    );
  }

  const { data: maxRow } = await supabase
    .from("cosechas_rff")
    .select("peso_kg")
    .eq("lote_id", input.lote_id)
    .eq("is_voided", false)
    .order("peso_kg", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxHistorico =
    maxRow?.peso_kg != null ? Number(maxRow.peso_kg) : null;
  if (
    pesoEsInusual(input.peso_kg, maxHistorico) &&
    !input.confirmar_peso_inusual
  ) {
    const max = maxHistorico ?? 0;
    return actionError(mensajePesoInusual(input.peso_kg, max));
  }

  const areaHa = Number(lote.area_ha);
  if (!Number.isFinite(areaHa) || areaHa <= 0) {
    return actionError("El área del lote no es válida para calcular rendimiento.");
  }

  const { data, error } = await supabase
    .from("cosechas_rff")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha: input.fecha,
      peso_kg: input.peso_kg,
      conteo_racimos: input.conteo_racimos,
      madurez_frutos_caidos_min: input.madurez_frutos_caidos_min ?? null,
      madurez_frutos_caidos_max: input.madurez_frutos_caidos_max ?? null,
      observaciones_calidad: input.observaciones_calidad ?? null,
      latitud: input.latitud ?? null,
      longitud: input.longitud ?? null,
      estado_acopio: "en_centro_acopio",
      created_by: user.id,
      source: input.source,
    })
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  const rendimiento_ton_ha = rendimientoTonHa(input.peso_kg, areaHa);

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "cosecha.registrar",
    titulo: "Registro de cosecha (RFF)",
    detalle: {
      registroId: data.id,
      loteCodigo: lote.codigo,
      fecha: input.fecha,
      pesoKg: input.peso_kg,
      racimos: input.conteo_racimos,
      rendimientoTonHa: rendimiento_ton_ha,
      latitud: input.latitud,
      longitud: input.longitud,
      pesoInusualConfirmado: input.confirmar_peso_inusual,
      observacionesCalidad: input.observaciones_calidad ?? null,
    },
  });

  return actionOk({
    id: data.id,
    rendimiento_ton_ha,
  });
}

export async function anularCosecha(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = anularRegistroCampoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no encontrada.");
  }
  const { profile } = session;
  const role = profile.role;
  if (
    role !== "operario" &&
    role !== "agronomo" &&
    !isSuperAdmin(profile)
  ) {
    return actionError("No tienes permiso para anular cosechas.");
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("cosechas_rff")
    .select("id, finca_id, is_voided, estado_acopio, remision_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return actionError(fetchErr?.message ?? "Cosecha no encontrada.");
  }
  if (row.is_voided) {
    return actionError("Este registro ya está anulado.");
  }
  if (row.estado_acopio === "en_transito" || row.remision_id) {
    return actionError(
      "No se puede anular: la fruta ya fue despachada o está en tránsito (HU29)."
    );
  }
  if (!isSuperAdmin(profile) && profile.finca_id !== row.finca_id) {
    return actionError("No puede anular registros de otra finca.");
  }

  const { data, error } = await supabase
    .from("cosechas_rff")
    .update({ is_voided: true })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id, finca_id, lote_id, fecha, peso_kg")
    .single();

  if (error || !data) {
    return actionError(error?.message ?? "No se pudo anular el registro.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", data.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: data.finca_id,
    actionKey: "cosecha.anular",
    titulo: "Anulación de registro de cosecha",
    detalle: {
      registroId: data.id,
      loteCodigo: lote?.codigo ?? data.lote_id,
      fecha: data.fecha,
      pesoKg: data.peso_kg,
    },
  });

  return actionOk({ id: data.id });
}
