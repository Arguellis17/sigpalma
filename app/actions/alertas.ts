"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  alertaFitosanitariaSchema,
  reportePlagaSchema,
  reporteEnfermedadSchema,
  type AlertaFitosanitariaInput,
  type ReportePlagaInput,
  type ReporteEnfermedadInput,
} from "@/lib/validations/operativo";
import { EVIDENCIA_TECNICA_BUCKET } from "@/lib/storage-evidencia-tecnica";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

const MAX_IMG_BYTES = 4 * 1024 * 1024;

/** Sube una imagen al bucket evidencia-tecnica bajo fincas/{finca_id}/alertas-fitosanitarias/ (operario o agrónomo de la finca). */
export async function subirEvidenciaAlertaFitosanitaria(
  formData: FormData
): Promise<ActionResult<{ path: string }>> {
  const fincaId = String(formData.get("finca_id") ?? "").trim();
  const archivo = formData.get("archivo");
  const file = archivo instanceof File && archivo.size > 0 ? archivo : null;

  if (!/^[0-9a-f-]{36}$/i.test(fincaId)) {
    return actionError("Finca no válida.");
  }
  if (!file) {
    return actionError("Seleccione un archivo de imagen.");
  }
  if (!file.type.startsWith("image/")) {
    return actionError("Solo se permiten imágenes (JPEG/PNG/WebP).");
  }
  if (file.size > MAX_IMG_BYTES) {
    return actionError("La imagen no puede superar 4 MB.");
  }

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  const role = session.profile.role;
  if (role !== "operario" && role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("No tiene permiso para subir evidencia de alerta.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== fincaId) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const path = `fincas/${fincaId}/alertas-fitosanitarias/${crypto.randomUUID()}.${safeExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(EVIDENCIA_TECNICA_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (upErr) {
    return actionError(upErr.message);
  }

  return actionOk({ path });
}

type CrearAlertaOpts = {
  /** HU25/HU26: exige categoría del ítem de catálogo. */
  categoriaRequerida?: "plaga" | "enfermedad";
};

async function crearAlertaFitosanitariaInternal(
  input: AlertaFitosanitariaInput,
  opts?: CrearAlertaOpts
): Promise<ActionResult<{ id: string; lote_estado_alerta: boolean }>> {
  const session = await getSessionProfile();
  if (!session?.user || !session.profile?.is_active) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }
  const role = session.profile.role;
  if (role !== "operario" && role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("No tiene permiso para registrar alertas.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();
  const user = session.user;

  if (opts?.categoriaRequerida && !input.catalogo_item_id) {
    const msg =
      opts.categoriaRequerida === "plaga"
        ? "Seleccione una plaga del catálogo (RN71)."
        : "Seleccione una enfermedad del catálogo (RN74).";
    return actionError(msg);
  }

  if (input.catalogo_item_id) {
    const { data: amenaza, error: catErr } = await supabase
      .from("catalogo_items")
      .select("id, categoria, activo, nombre")
      .eq("id", input.catalogo_item_id)
      .maybeSingle();
    if (catErr || !amenaza) {
      return actionError("Amenaza del catálogo no encontrada.");
    }
    if (
      !["plaga", "enfermedad", "otro"].includes(amenaza.categoria) ||
      !amenaza.activo
    ) {
      return actionError(
        "Seleccione una plaga o enfermedad activa del catálogo fitosanitario."
      );
    }
    if (opts?.categoriaRequerida && amenaza.categoria !== opts.categoriaRequerida) {
      return actionError(
        opts.categoriaRequerida === "plaga"
          ? "El ítem seleccionado no es una plaga del catálogo (RN71)."
          : "El ítem seleccionado no es una enfermedad del catálogo (RN74)."
      );
    }
  }

  const lote_estado_alerta = input.severidad === "critica";

  const { data, error } = await supabase
    .from("alertas_fitosanitarias")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      catalogo_item_id: input.catalogo_item_id ?? null,
      severidad: input.severidad,
      descripcion: input.descripcion ?? null,
      evidencia_urls: input.evidencia_urls,
      lote_estado_alerta,
      validacion_estado: "pendiente",
      created_by: user.id,
      source: input.source,
    })
    .select("id, lote_estado_alerta")
    .single();

  if (error) {
    return actionError(error.message);
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", input.lote_id)
    .maybeSingle();

  let amenazaNombre: string | null = null;
  if (input.catalogo_item_id) {
    const { data: cat } = await supabase
      .from("catalogo_items")
      .select("nombre")
      .eq("id", input.catalogo_item_id)
      .maybeSingle();
    amenazaNombre = cat?.nombre ?? null;
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "alerta.crear",
    titulo:
      opts?.categoriaRequerida === "plaga"
        ? "Reporte de plaga en campo"
        : opts?.categoriaRequerida === "enfermedad"
          ? "Reporte de enfermedad en campo"
          : "Reporte fitosanitario en campo",
    detalle: {
      alertaId: data.id,
      loteCodigo: lote?.codigo ?? input.lote_id,
      severidad: input.severidad,
      amenaza: amenazaNombre,
      tipoReporte: opts?.categoriaRequerida ?? null,
      descripcion: input.descripcion ?? null,
      loteEnEstadoAlerta: data.lote_estado_alerta,
      evidencias: input.evidencia_urls.length,
      validacionEstado: "pendiente",
    },
  });

  return actionOk({
    id: data.id,
    lote_estado_alerta: data.lote_estado_alerta,
  });
}

export type AlertaDesdeCensoInput = {
  fincaId: string;
  loteId: string;
  loteCodigo: string;
  catalogoItemId: string;
  amenazaNombre: string;
  censoId: string;
  incidenciaPct: number;
  palmasInspeccionadas: number;
  palmasAfectadas: number;
  createdBy: string;
};

/**
 * HU24: genera alerta pendiente en bandeja HU15 cuando el censo supera umbral.
 * Evita duplicados si ya hay alerta pendiente para mismo lote + amenaza.
 */
export async function crearAlertaDesdeCensoUmbral(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: AlertaDesdeCensoInput
): Promise<string | null> {
  const { count } = await supabase
    .from("alertas_fitosanitarias")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", input.loteId)
    .eq("catalogo_item_id", input.catalogoItemId)
    .eq("validacion_estado", "pendiente")
    .eq("is_voided", false);

  if ((count ?? 0) > 0) {
    return null;
  }

  const descripcion =
    `Alerta automática por censo sanitario (${input.incidenciaPct}% incidencia, ` +
    `${input.palmasAfectadas}/${input.palmasInspeccionadas} palmas). ` +
    `Amenaza: ${input.amenazaNombre}. Censo ID: ${input.censoId}.`;

  const { data, error } = await supabase
    .from("alertas_fitosanitarias")
    .insert({
      finca_id: input.fincaId,
      lote_id: input.loteId,
      catalogo_item_id: input.catalogoItemId,
      severidad: "alta",
      descripcion,
      evidencia_urls: [],
      lote_estado_alerta: false,
      validacion_estado: "pendiente",
      created_by: input.createdBy,
      source: "web",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[alerta_desde_censo]", error?.message);
    return null;
  }

  await registrarEventoFinca({
    fincaId: input.fincaId,
    actionKey: "alerta.crear",
    titulo: "Alerta por umbral de censo sanitario",
    detalle: {
      alertaId: data.id,
      origen: "censo_sanitario",
      censoId: input.censoId,
      loteCodigo: input.loteCodigo,
      amenaza: input.amenazaNombre,
      incidenciaPct: input.incidenciaPct,
      severidad: "alta",
      validacionEstado: "pendiente",
    },
  });

  return data.id;
}

export async function crearAlertaFitosanitaria(
  raw: unknown
): Promise<ActionResult<{ id: string; lote_estado_alerta: boolean }>> {
  const parsed = alertaFitosanitariaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  return crearAlertaFitosanitariaInternal(parsed.data);
}

/** HU25 / RF25: reporte de plaga con catálogo y foto obligatorios (RN71–RN73). */
export async function crearReportePlaga(
  raw: unknown
): Promise<ActionResult<{ id: string; lote_estado_alerta: boolean }>> {
  const parsed = reportePlagaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ReportePlagaInput = parsed.data;
  return crearAlertaFitosanitariaInternal(input, { categoriaRequerida: "plaga" });
}

/** HU26 / RF26: reporte de enfermedad con catálogo y foto obligatorios (RN74–RN76). */
export async function crearReporteEnfermedad(
  raw: unknown
): Promise<ActionResult<{ id: string; lote_estado_alerta: boolean }>> {
  const parsed = reporteEnfermedadSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ReporteEnfermedadInput = parsed.data;
  return crearAlertaFitosanitariaInternal(input, { categoriaRequerida: "enfermedad" });
}
