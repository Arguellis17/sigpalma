"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  actualizarAnalisisSueloSchema,
  anularAnalisisSueloSchema,
  registrarAnalisisSueloSchema,
  type RegistrarAnalisisSueloInput,
} from "@/lib/validations/suelo";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";
import type { Database, Tables } from "@/lib/database.types";
import { z } from "zod";

type AnalisisSueloRow = Database["public"]["Tables"]["analisis_suelo"]["Row"];

const EVIDENCIA_BUCKET = "evidencia-tecnica";
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function canAccessAnalisisSueloFinca(
  profile: Tables<"profiles"> | null,
  fincaId: string
): boolean {
  if (!profile) return false;
  if (profile.role === "superadmin") return true;
  if (!profile.finca_id) return false;
  return profile.finca_id === fincaId;
}

const MUTATE_ROLES = ["superadmin", "admin", "agronomo"] as const;

function assertPuedeMutarAnalisisSuelo(
  profile: Tables<"profiles">,
  fincaId: string
): string | null {
  if (!profile.role || !MUTATE_ROLES.includes(profile.role as (typeof MUTATE_ROLES)[number])) {
    return "No tienes permiso para gestionar análisis de suelo.";
  }
  if (!canAccessAnalisisSueloFinca(profile, fincaId)) {
    return "No tiene permiso para esta finca.";
  }
  return null;
}

async function assertLoteEnFinca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fincaId: string,
  loteId: string
): Promise<string | null> {
  const { data: lote, error } = await supabase
    .from("lotes")
    .select("finca_id")
    .eq("id", loteId)
    .maybeSingle();
  if (error || !lote) return "Lote no encontrado.";
  if (lote.finca_id !== fincaId) {
    return "El lote no pertenece a la finca seleccionada.";
  }
  return null;
}

function esArchivoPdfValido(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

function validarArchivoPdfLaboratorio(file: File): string | null {
  if (!esArchivoPdfValido(file)) {
    return "El adjunto debe ser un archivo PDF.";
  }
  if (file.size > MAX_PDF_BYTES) {
    return "El PDF no puede superar 5 MB.";
  }
  return null;
}

/** Columnas de análisis compartidas entre insert/update (JSON y formulario). */
function columnasAnalisisDesdeInput(input: RegistrarAnalisisSueloInput) {
  return {
    ph: input.ph ?? null,
    humedad_pct: input.humedad_pct ?? null,
    compactacion:
      input.compactacion !== null && input.compactacion !== undefined
        ? String(input.compactacion)
        : null,
    fertilidad_completa: input.fertilidad_completa ?? null,
    textura: input.textura ?? null,
    aluminio: input.aluminio ?? null,
    cic: input.cic ?? null,
    materia_organica_pct: input.materia_organica_pct ?? null,
    drenaje_campo: input.drenaje_campo ?? null,
    nutrientes: input.nutrientes ?? null,
    notas: input.notas?.trim() ?? null,
    archivo_url: input.archivo_url ?? null,
  };
}

function detalleAuditoriaAnalisis(
  input: RegistrarAnalisisSueloInput,
  extras: {
    analisisId: string;
    loteCodigo: string;
    tieneAdjuntoLaboratorio: boolean;
    archivoReemplazado?: boolean;
  }
) {
  return {
    analisisId: extras.analisisId,
    loteCodigo: extras.loteCodigo,
    fechaAnalisis: input.fecha_analisis,
    ph: input.ph ?? null,
    humedadPct: input.humedad_pct ?? null,
    compactacion: input.compactacion ?? null,
    fertilidadCompleta: input.fertilidad_completa ?? null,
    textura: input.textura ?? null,
    aluminio: input.aluminio ?? null,
    cic: input.cic ?? null,
    materiaOrganicaPct: input.materia_organica_pct ?? null,
    drenajeCampo: input.drenaje_campo ?? null,
    nutrientes: input.nutrientes ?? null,
    tieneAdjuntoLaboratorio: extras.tieneAdjuntoLaboratorio,
    notas: input.notas?.trim() ?? null,
    ...(extras.archivoReemplazado !== undefined
      ? { archivoReemplazado: extras.archivoReemplazado }
      : {}),
  };
}

// ─── HU16: Registrar análisis de suelo ───────────────────────────────────────

export async function registrarAnalisisSuelo(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarAnalisisSueloSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarAnalisisSueloInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile || !session.user) {
    return actionError("Sesión no encontrada.");
  }

  const permErr = assertPuedeMutarAnalisisSuelo(session.profile, input.finca_id);
  if (permErr) return actionError(permErr);

  const supabase = await createClient();
  const loteErr = await assertLoteEnFinca(supabase, input.finca_id, input.lote_id);
  if (loteErr) return actionError(loteErr);

  const { data, error } = await supabase
    .from("analisis_suelo")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha_analisis: input.fecha_analisis,
      ...columnasAnalisisDesdeInput(input),
      created_by: session.user.id,
      source: "web",
      is_voided: false,
    })
    .select("id")
    .single();

  if (error || !data) return actionError(error?.message ?? "No se pudo registrar el análisis.");

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", input.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "suelo.registrar",
    titulo: "Nuevo análisis de suelo",
    detalle: detalleAuditoriaAnalisis(input, {
      analisisId: data.id,
      loteCodigo: lote?.codigo ?? input.lote_id,
      tieneAdjuntoLaboratorio: Boolean(input.archivo_url),
    }),
  });

  return actionOk({ id: data.id });
}

export async function actualizarAnalisisSuelo(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarAnalisisSueloSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile) {
    return actionError("Sesión no encontrada.");
  }

  const permErr = assertPuedeMutarAnalisisSuelo(session.profile, input.finca_id);
  if (permErr) return actionError(permErr);

  const supabase = await createClient();
  const loteErr = await assertLoteEnFinca(supabase, input.finca_id, input.lote_id);
  if (loteErr) return actionError(loteErr);

  const { data, error } = await supabase
    .from("analisis_suelo")
    .update({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha_analisis: input.fecha_analisis,
      ...columnasAnalisisDesdeInput(input),
    })
    .eq("id", input.id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (error || !data) return actionError(error?.message ?? "No se pudo actualizar el análisis.");
  return actionOk({ id: data.id });
}

export async function anularAnalisisSuelo(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = anularAnalisisSueloSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile) {
    return actionError("Sesión no encontrada.");
  }

  const allowedRoles: string[] = ["superadmin", "admin", "agronomo"];
  if (!allowedRoles.includes(session.profile.role ?? "")) {
    return actionError("No tienes permiso para anular análisis de suelo.");
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("analisis_suelo")
    .select("id, finca_id, lote_id, fecha_analisis, archivo_url")
    .eq("id", id)
    .eq("is_voided", false)
    .maybeSingle();

  if (fetchErr || !row) {
    return actionError(fetchErr?.message ?? "Análisis no encontrado o ya anulado.");
  }

  if (!canAccessAnalisisSueloFinca(session.profile, row.finca_id)) {
    return actionError("No tiene permiso para anular este análisis.");
  }

  const archivoPath = row.archivo_url;

  const { data, error } = await supabase
    .from("analisis_suelo")
    .update({ is_voided: true, archivo_url: null })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id, finca_id, lote_id, fecha_analisis")
    .single();

  if (error || !data) return actionError(error?.message ?? "No se pudo anular el análisis.");

  if (archivoPath) {
    const { error: rmErr } = await supabase.storage
      .from(EVIDENCIA_BUCKET)
      .remove([archivoPath]);
    if (rmErr) {
      console.error("[analisis_suelo] anular: no se pudo borrar PDF en Storage", rmErr.message);
    }
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", data.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: data.finca_id,
    actionKey: "suelo.anular",
    titulo: "Análisis de suelo anulado",
    detalle: {
      analisisId: data.id,
      loteCodigo: lote?.codigo ?? data.lote_id,
      fechaAnalisis: data.fecha_analisis,
    },
  });

  return actionOk({ id: data.id });
}

// ─── HU16: Listar análisis por lote / finca ──────────────────────────────────

export async function listarAnalisisPorFinca(
  fincaId: string,
  loteId?: string
): Promise<ActionResult<AnalisisSueloRow[]>> {
  if (!fincaId) return actionError("Indique la finca.");

  const session = await getSessionProfile();
  if (!session?.profile) return actionError("Sesión no encontrada.");

  if (!canAccessAnalisisSueloFinca(session.profile, fincaId)) {
    return actionError("No tiene permiso para ver análisis de esta finca.");
  }

  const supabase = await createClient();

  let query = supabase
    .from("analisis_suelo")
    .select("*")
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("created_at", { ascending: false });

  if (loteId) {
    query = query.eq("lote_id", loteId);
  }

  const { data, error } = await query;
  if (error) return actionError(error.message);
  return actionOk(data ?? []);
}

function parseFormDataNumber(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseFormDataText(formData: FormData, name: string): string | null {
  const raw = formData.get(name);
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  return s.length ? s : null;
}

type RegistroAnalisisFormFields = {
  finca_id: FormDataEntryValue | null;
  lote_id: FormDataEntryValue | null;
  fecha_analisis: FormDataEntryValue | null;
  ph: number | null;
  humedad_pct: number | null;
  compactacion: number | null;
  fertilidad_completa: string | null;
  textura: string | null;
  aluminio: number | null;
  cic: number | null;
  materia_organica_pct: number | null;
  drenaje_campo: string | null;
  nutrientes: null;
  notas: string | null;
  archivo_url: null;
};

function formDataToRegistroPayload(formData: FormData): RegistroAnalisisFormFields {
  const phRaw = formData.get("ph");
  const humedadRaw = formData.get("humedad_pct");
  const compactacionRaw = formData.get("compactacion");
  const notasRaw = formData.get("notas");
  return {
    finca_id: formData.get("finca_id"),
    lote_id: formData.get("lote_id"),
    fecha_analisis: formData.get("fecha_analisis"),
    ph: phRaw === "" || phRaw == null ? null : Number(phRaw),
    humedad_pct: humedadRaw === "" || humedadRaw == null ? null : Number(humedadRaw),
    compactacion:
      compactacionRaw === "" || compactacionRaw == null ? null : Number(compactacionRaw),
    fertilidad_completa: parseFormDataText(formData, "fertilidad_completa"),
    textura: parseFormDataText(formData, "textura"),
    aluminio: parseFormDataNumber(formData, "aluminio"),
    cic: parseFormDataNumber(formData, "cic"),
    materia_organica_pct: parseFormDataNumber(formData, "materia_organica_pct"),
    drenaje_campo: parseFormDataText(formData, "drenaje_campo"),
    nutrientes: null,
    notas: notasRaw && String(notasRaw).trim() ? String(notasRaw).trim() : null,
    archivo_url: null,
  };
}

/** Registro con archivo PDF opcional (multipart desde el formulario). */
export async function registrarAnalisisSueloDesdeFormulario(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const base = formDataToRegistroPayload(formData);
  const parsed = registrarAnalisisSueloSchema.safeParse(base);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input = parsed.data;

  const archivo = formData.get("archivo");
  const file =
    archivo instanceof File && archivo.size > 0 ? archivo : null;

  if (file) {
    const pdfErr = validarArchivoPdfLaboratorio(file);
    if (pdfErr) return actionError(pdfErr);
  }

  const session = await getSessionProfile();
  if (!session?.profile || !session.user) {
    return actionError("Sesión no encontrada.");
  }

  const permErr = assertPuedeMutarAnalisisSuelo(session.profile, input.finca_id);
  if (permErr) return actionError(permErr);

  const supabase = await createClient();
  const loteErr = await assertLoteEnFinca(supabase, input.finca_id, input.lote_id);
  if (loteErr) return actionError(loteErr);

  const id = crypto.randomUUID();
  let archivoPath: string | null = null;

  if (file) {
    archivoPath = `fincas/${input.finca_id}/analisis-suelo/${id}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(EVIDENCIA_BUCKET)
      .upload(archivoPath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) {
      return actionError(upErr.message);
    }
  }

  const { data, error } = await supabase
    .from("analisis_suelo")
    .insert({
      id,
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha_analisis: input.fecha_analisis,
      ...columnasAnalisisDesdeInput(input),
      archivo_url: archivoPath,
      created_by: session.user.id,
      source: "web",
      is_voided: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (archivoPath) {
      await supabase.storage.from(EVIDENCIA_BUCKET).remove([archivoPath]);
    }
    return actionError(error?.message ?? "No se pudo registrar el análisis.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", input.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "suelo.registrar",
    titulo: "Nuevo análisis de suelo",
    detalle: detalleAuditoriaAnalisis(input, {
      analisisId: data.id,
      loteCodigo: lote?.codigo ?? input.lote_id,
      tieneAdjuntoLaboratorio: Boolean(archivoPath),
    }),
  });

  return actionOk({ id: data.id });
}

export async function actualizarAnalisisSueloDesdeFormulario(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const idRaw = formData.get("id");
  const base = { ...formDataToRegistroPayload(formData), id: idRaw };
  const parsed = actualizarAnalisisSueloSchema.safeParse(base);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input = parsed.data;

  const archivo = formData.get("archivo");
  const file =
    archivo instanceof File && archivo.size > 0 ? archivo : null;

  if (file) {
    const pdfErr = validarArchivoPdfLaboratorio(file);
    if (pdfErr) return actionError(pdfErr);
  }

  const session = await getSessionProfile();
  if (!session?.profile) {
    return actionError("Sesión no encontrada.");
  }

  const supabase = await createClient();
  const { data: prev, error: perr } = await supabase
    .from("analisis_suelo")
    .select("id, archivo_url, finca_id")
    .eq("id", input.id)
    .eq("is_voided", false)
    .maybeSingle();

  if (perr || !prev) {
    return actionError("Análisis no encontrado o anulado.");
  }

  const permErr = assertPuedeMutarAnalisisSuelo(session.profile, input.finca_id);
  if (permErr) return actionError(permErr);
  if (!canAccessAnalisisSueloFinca(session.profile, prev.finca_id)) {
    return actionError("No tiene permiso para editar este análisis.");
  }

  const loteErr = await assertLoteEnFinca(supabase, input.finca_id, input.lote_id);
  if (loteErr) return actionError(loteErr);

  let archivoPath: string | null = prev.archivo_url;

  if (file) {
    const newPath = `fincas/${input.finca_id}/analisis-suelo/${input.id}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(EVIDENCIA_BUCKET)
      .upload(newPath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      return actionError(upErr.message);
    }
    if (prev.archivo_url && prev.archivo_url !== newPath) {
      await supabase.storage.from(EVIDENCIA_BUCKET).remove([prev.archivo_url]);
    }
    archivoPath = newPath;
  }

  const { data, error } = await supabase
    .from("analisis_suelo")
    .update({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha_analisis: input.fecha_analisis,
      ...columnasAnalisisDesdeInput(input),
      archivo_url: archivoPath,
    })
    .eq("id", input.id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (error || !data) {
    return actionError(error?.message ?? "No se pudo actualizar el análisis.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", input.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "suelo.actualizar",
    titulo: "Análisis de suelo actualizado",
    detalle: detalleAuditoriaAnalisis(input, {
      analisisId: input.id,
      loteCodigo: lote?.codigo ?? input.lote_id,
      tieneAdjuntoLaboratorio: Boolean(archivoPath),
      archivoReemplazado: Boolean(file),
    }),
  });

  return actionOk({ id: data.id });
}

export async function obtenerUrlDescargaAnalisisSuelo(
  analisisId: string
): Promise<ActionResult<{ url: string }>> {
  const idParse = z.string().uuid().safeParse(analisisId);
  if (!idParse.success) {
    return actionError("Identificador inválido.");
  }

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }

  const role = session.profile.role;
  const allowedRead = ["superadmin", "admin", "agronomo", "operario"];
  if (!allowedRead.includes(role ?? "")) {
    return actionError("No autorizado.");
  }

  const supabase = await createClient();
  const { data: row, error: re } = await supabase
    .from("analisis_suelo")
    .select("archivo_url, finca_id, is_voided")
    .eq("id", analisisId)
    .maybeSingle();

  if (re || !row || row.is_voided) {
    return actionError("Análisis no encontrado.");
  }
  if (!row.archivo_url) {
    return actionError("Este análisis no tiene archivo adjunto.");
  }
  if (!canAccessAnalisisSueloFinca(session.profile, row.finca_id)) {
    return actionError("No tiene acceso a este archivo.");
  }

  const { data: signed, error: se } = await supabase.storage
    .from(EVIDENCIA_BUCKET)
    .createSignedUrl(row.archivo_url, 3600);

  if (se || !signed?.signedUrl) {
    return actionError(se?.message ?? "No se pudo generar el enlace de descarga.");
  }

  return actionOk({ url: signed.signedUrl });
}
