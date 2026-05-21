"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getSessionProfile,
  hasRole,
  isSuperAdmin,
} from "@/lib/auth/session-profile";
import { pendienteRequiereValidacionTecnico } from "@/lib/preparacion-terreno";
import {
  registrarPreparacionTerrenoSchema,
  validarPreparacionTerrenoSchema,
  type RegistrarPreparacionTerrenoInput,
  type ValidarPreparacionTerrenoInput,
} from "@/lib/validations/preparacion-terreno";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export async function registrarPreparacionTerreno(
  raw: unknown
): Promise<ActionResult<{ id: string; requiere_validacion_tecnico: boolean }>> {
  const parsed = registrarPreparacionTerrenoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarPreparacionTerrenoInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user) {
    return actionError("Sesión no válida.");
  }
  const profile = session.profile;
  if (!hasRole(profile, ["operario", "agronomo", "superadmin"])) {
    return actionError("No tiene permiso para registrar preparación de terreno.");
  }
  if (
    profile?.role !== "superadmin" &&
    profile?.finca_id &&
    profile.finca_id !== input.finca_id
  ) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();

  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select("id, codigo, finca_id, activo, estado_cultivo")
    .eq("id", input.lote_id)
    .maybeSingle();

  if (loteErr || !lote) {
    return actionError("Lote no encontrado.");
  }
  if (lote.finca_id !== input.finca_id) {
    return actionError("El lote no pertenece a la finca.");
  }
  if (!lote.activo) {
    return actionError("El lote no está activo.");
  }
  if (lote.estado_cultivo !== "planificado_siembra") {
    return actionError(
      "Solo lotes planificados para siembra admiten preparación de terreno (HU10)."
    );
  }

  const { data: plan, error: planErr } = await supabase
    .from("planes_siembra")
    .select("id, finca_id, lote_id, is_voided")
    .eq("id", input.plan_siembra_id)
    .maybeSingle();

  if (planErr || !plan) {
    return actionError("Plan de siembra no encontrado.");
  }
  if (plan.is_voided || plan.lote_id !== input.lote_id) {
    return actionError("El plan de siembra no corresponde al lote seleccionado.");
  }

  const { data: existente } = await supabase
    .from("preparaciones_terreno")
    .select("id")
    .eq("lote_id", input.lote_id)
    .eq("is_voided", false)
    .maybeSingle();

  if (existente) {
    return actionError("Este lote ya tiene un registro de preparación de terreno.");
  }

  const requiereValidacion = pendienteRequiereValidacionTecnico(
    input.pendiente_final_pct
  );
  const estado = requiereValidacion
    ? "pendiente_validacion_tecnico"
    : "aprobado";

  const { data: row, error: insertErr } = await supabase
    .from("preparaciones_terreno")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      plan_siembra_id: input.plan_siembra_id,
      pendiente_final_pct: input.pendiente_final_pct,
      actividades: input.actividades,
      estado,
      notas: input.notas?.trim() ?? null,
      created_by: session.user.id,
      source: input.source,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return actionError(insertErr?.message ?? "No se pudo registrar la preparación.");
  }

  if (!requiereValidacion) {
    const { error: loteUpErr } = await supabase
      .from("lotes")
      .update({
        estado_cultivo: "listo_para_siembra",
        pendiente_pct: input.pendiente_final_pct,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.lote_id)
      .eq("estado_cultivo", "planificado_siembra");

    if (loteUpErr) {
      return actionError(
        "Registro guardado pero no se pudo actualizar el estado del lote. Contacte al administrador."
      );
    }
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "siembra.preparacion_terreno",
    titulo: "Preparación de terreno registrada",
    detalle: {
      preparacionId: row.id,
      loteCodigo: lote.codigo,
      planSiembraId: input.plan_siembra_id,
      pendienteFinalPct: input.pendiente_final_pct,
      actividades: input.actividades,
      estado,
      notas: input.notas?.trim() ?? null,
    },
  });

  return actionOk({
    id: row.id,
    requiere_validacion_tecnico: requiereValidacion,
  });
}

export async function validarPreparacionTerreno(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = validarPreparacionTerrenoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ValidarPreparacionTerrenoInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user) {
    return actionError("Sesión no válida.");
  }
  const profile = session.profile;
  if (!hasRole(profile, ["agronomo", "admin", "superadmin"])) {
    return actionError("Solo el técnico agrónomo puede validar pendientes críticas.");
  }

  const supabase = await createClient();

  const { data: prep, error: fetchErr } = await supabase
    .from("preparaciones_terreno")
    .select(
      "id, finca_id, lote_id, pendiente_final_pct, estado, is_voided, actividades"
    )
    .eq("id", input.id)
    .maybeSingle();

  if (fetchErr || !prep) {
    return actionError("Registro de preparación no encontrado.");
  }
  if (prep.is_voided) {
    return actionError("El registro está anulado.");
  }
  if (prep.estado !== "pendiente_validacion_tecnico") {
    return actionError("Este registro no está pendiente de validación técnica.");
  }
  if (
    profile?.role !== "superadmin" &&
    profile?.finca_id &&
    prep.finca_id !== profile.finca_id
  ) {
    return actionError("El registro no pertenece a su finca.");
  }

  const nowIso = new Date().toISOString();

  const { data: updated, error: upErr } = await supabase
    .from("preparaciones_terreno")
    .update({
      estado: "aprobado",
      validado_por: session.user.id,
      validado_en: nowIso,
      observacion_validacion: input.observacion_validacion.trim(),
      updated_at: nowIso,
    })
    .eq("id", input.id)
    .eq("estado", "pendiente_validacion_tecnico")
    .select("id, lote_id")
    .single();

  if (upErr || !updated) {
    return actionError(upErr?.message ?? "No se pudo validar la preparación.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", updated.lote_id)
    .maybeSingle();

  const { error: loteUpErr } = await supabase
    .from("lotes")
    .update({
      estado_cultivo: "listo_para_siembra",
      pendiente_pct: prep.pendiente_final_pct,
      updated_at: nowIso,
    })
    .eq("id", updated.lote_id)
    .eq("estado_cultivo", "planificado_siembra");

  if (loteUpErr) {
    return actionError(
      "Validación registrada pero no se pudo actualizar el estado del lote."
    );
  }

  await registrarEventoFinca({
    fincaId: prep.finca_id,
    actionKey: "siembra.preparacion_validar",
    titulo: "Validación técnica de preparación de terreno",
    detalle: {
      preparacionId: prep.id,
      loteCodigo: lote?.codigo ?? updated.lote_id,
      pendienteFinalPct: Number(prep.pendiente_final_pct),
      observacion: input.observacion_validacion.trim(),
    },
  });

  return actionOk({ id: updated.id });
}

export type PreparacionTerrenoListRow = {
  id: string;
  lote_codigo: string;
  pendiente_final_pct: number;
  actividades: string[];
  estado: string;
  created_at: string;
};

export async function listPreparacionesTerrenoForFinca(
  fincaId: string
): Promise<ActionResult<PreparacionTerrenoListRow[]>> {
  const fid = fincaId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(fid)) {
    return actionError("Finca no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("preparaciones_terreno")
    .select("id, lote_id, pendiente_final_pct, actividades, estado, created_at")
    .eq("finca_id", fid)
    .eq("is_voided", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return actionError(error.message);

  const rows = data ?? [];
  const loteIds = [...new Set(rows.map((r) => r.lote_id))];
  const { data: lotesRows } = loteIds.length
    ? await supabase.from("lotes").select("id, codigo").in("id", loteIds)
    : { data: [] as { id: string; codigo: string }[] };

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));

  return actionOk(
    rows.map((r) => ({
      id: r.id,
      lote_codigo: loteMap.get(r.lote_id) ?? "—",
      pendiente_final_pct: Number(r.pendiente_final_pct),
      actividades: r.actividades ?? [],
      estado: r.estado,
      created_at: r.created_at,
    }))
  );
}
