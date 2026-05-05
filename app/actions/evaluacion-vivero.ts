"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  anularEvaluacionViveroSchema,
  crearEvaluacionViveroSchema,
  type CrearEvaluacionViveroInput,
} from "@/lib/validations/evaluacion-vivero";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

const EVIDENCIA_BUCKET = "evidencia-tecnica";
const MAX_IMG_BYTES = 4 * 1024 * 1024;

export async function crearEvaluacionVivero(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearEvaluacionViveroSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearEvaluacionViveroInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("Solo el técnico agrónomo puede registrar la evaluación de vivero.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();

  const { data: germ, error: ge } = await supabase
    .from("registros_germinacion")
    .select("id, finca_id, is_voided")
    .eq("id", input.germinacion_id)
    .maybeSingle();

  if (ge || !germ) return actionError("Registro de germinación no encontrado.");
  if (germ.is_voided) return actionError("La germinación vinculada está anulada.");
  if (germ.finca_id !== input.finca_id) {
    return actionError("La germinación no pertenece a la finca del formulario.");
  }

  const { data: existente } = await supabase
    .from("evaluaciones_vivero")
    .select("id")
    .eq("germinacion_id", input.germinacion_id)
    .eq("is_voided", false)
    .maybeSingle();

  if (existente) {
    return actionError(
      "Ya existe una evaluación de vivero activa para esta germinación. Anúlela antes de crear otra."
    );
  }

  const evidencia = (input.evidencia_urls ?? []) as string[];

  const { data: inserted, error: insErr } = await supabase
    .from("evaluaciones_vivero")
    .insert({
      finca_id: input.finca_id,
      germinacion_id: input.germinacion_id,
      total_inicial: input.total_inicial,
      unidades_germinadas: input.unidades_germinadas,
      unidades_descartadas: input.unidades_descartadas,
      motivo_descarte: input.motivo_descarte?.trim() ?? null,
      observaciones_fitosanitarias: input.observaciones_fitosanitarias?.trim() ?? null,
      concepto: input.concepto,
      evidencia_urls: evidencia,
      created_by: session.user.id,
      source: "web",
      is_voided: false,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    const msg = insErr?.message ?? "No se pudo registrar la evaluación.";
    if (insErr?.code === "23514") {
      return actionError("Revise conteos y motivo de descarte.");
    }
    return actionError(msg);
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "vivero.evaluacion_crear",
    titulo:
      input.concepto === "apto_trasplante"
        ? "Evaluación de vivero: Apto para trasplante"
        : "Evaluación de vivero: No apto",
    detalle: {
      evaluacionId: inserted.id,
      germinacionId: input.germinacion_id,
      concepto: input.concepto,
      totalInicial: input.total_inicial,
      unidadesGerminadas: input.unidades_germinadas,
      unidadesDescartadas: input.unidades_descartadas,
      alertaAdministrativa: input.concepto === "no_apto",
    },
  });

  return actionOk({ id: inserted.id });
}

export async function anularEvaluacionVivero(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = anularEvaluacionViveroSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("Sin permiso para anular la evaluación.");
  }

  const supabase = await createClient();
  const { data: prev, error: pe } = await supabase
    .from("evaluaciones_vivero")
    .select("id, finca_id, is_voided")
    .eq("id", id)
    .maybeSingle();

  if (pe || !prev) return actionError("Evaluación no encontrada.");
  if (prev.is_voided) return actionError("La evaluación ya está anulada.");
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== prev.finca_id) {
    return actionError("No puede anular evaluaciones de otra finca.");
  }

  const { data: updated, error: ue } = await supabase
    .from("evaluaciones_vivero")
    .update({ is_voided: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (ue || !updated) {
    return actionError(ue?.message ?? "No se pudo anular.");
  }

  await registrarEventoFinca({
    fincaId: prev.finca_id,
    actionKey: "vivero.evaluacion_anular",
    titulo: "Evaluación de vivero anulada",
    detalle: { evaluacionId: id },
  });

  return actionOk({ id: updated.id });
}

/** Sube una imagen al bucket evidencia-tecnica; retorna la ruta almacenada en DB. */
export async function subirEvidenciaEvaluacionVivero(
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
  if (session.profile.role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("Solo el técnico agrónomo puede subir evidencia de vivero.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== fincaId) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const path = `vivero/evaluaciones/${fincaId}/${crypto.randomUUID()}.${safeExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(EVIDENCIA_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (upErr) {
    return actionError(upErr.message);
  }

  return actionOk({ path });
}
