"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  alertaFitosanitariaSchema,
  type AlertaFitosanitariaInput,
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

export async function crearAlertaFitosanitaria(
  raw: unknown
): Promise<ActionResult<{ id: string; lote_estado_alerta: boolean }>> {
  const parsed = alertaFitosanitariaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: AlertaFitosanitariaInput = parsed.data;

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
    titulo: "Reporte fitosanitario en campo",
    detalle: {
      alertaId: data.id,
      loteCodigo: lote?.codigo ?? input.lote_id,
      severidad: input.severidad,
      amenaza: amenazaNombre,
      descripcion: input.descripcion ?? null,
      loteEnEstadoAlerta: data.lote_estado_alerta,
      evidencias: input.evidencia_urls.length,
    },
  });

  return actionOk({
    id: data.id,
    lote_estado_alerta: data.lote_estado_alerta,
  });
}
