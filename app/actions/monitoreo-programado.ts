"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { todayColombiaYmd } from "@/lib/date-colombia";
import {
  actualizarMonitoreoProgramadoSchema,
  anularMonitoreoProgramadoSchema,
  crearMonitoreoProgramadoSchema,
  marcarMonitoreoCompletadoSchema,
  type ActualizarMonitoreoProgramadoInput,
  type CrearMonitoreoProgramadoInput,
} from "@/lib/validations/monitoreo-programado";
import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

const DUP_MSG =
  "Ya existe una inspección pendiente para este lote en la misma fecha (CU13). Cambie la fecha o anule la anterior.";

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  return err?.code === "23505" || Boolean(err?.message?.includes("monitoreos_fitos_prog_lote_fecha_pendiente"));
}

async function assertLoteActivoFinca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fincaId: string,
  loteId: string
): Promise<ActionResult<{ codigo: string }>> {
  const { data: lote, error } = await supabase
    .from("lotes")
    .select("id, finca_id, codigo, activo")
    .eq("id", loteId)
    .maybeSingle();

  if (error || !lote) return actionError("Lote no encontrado.");
  if (lote.finca_id !== fincaId) {
    return actionError("El lote no pertenece a la finca.");
  }
  if (!lote.activo) {
    return actionError("El lote no está activo (RN35).");
  }
  return actionOk({ codigo: lote.codigo });
}

async function assertOperarioAsignado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fincaId: string,
  operarioId: string
): Promise<ActionResult<{ nombre: string }>> {
  const { data: p, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, finca_id, is_active")
    .eq("id", operarioId)
    .maybeSingle();

  if (error || !p) return actionError("Operario no encontrado.");
  if (!p.is_active) return actionError("El operario seleccionado no está activo.");
  if (p.role !== "operario") {
    return actionError("Solo puede asignar usuarios con rol operario.");
  }
  if (p.finca_id !== fincaId) {
    return actionError("El operario no pertenece a esta finca.");
  }
  return actionOk({ nombre: p.full_name || "Operario" });
}

function assertFechaInspeccionRn36(fecha: string): ActionResult<void> {
  const hoy = todayColombiaYmd();
  if (fecha < hoy) {
    return actionError("La fecha de inspección no puede ser anterior a hoy (RN36).");
  }
  return actionOk(undefined);
}

export async function crearMonitoreoProgramado(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearMonitoreoProgramadoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearMonitoreoProgramadoInput = parsed.data;

  const fechaOk = assertFechaInspeccionRn36(input.fecha_inspeccion);
  if (!fechaOk.success) return fechaOk;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "agronomo") {
    return actionError("Solo el técnico agrónomo puede programar monitoreos fitosanitarios.");
  }
  if (session.profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();

  const loteV = await assertLoteActivoFinca(supabase, input.finca_id, input.lote_id);
  if (!loteV.success) return loteV;

  const opV = await assertOperarioAsignado(supabase, input.finca_id, input.assigned_to);
  if (!opV.success) return opV;

  const { data: inserted, error: insErr } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      fecha_inspeccion: input.fecha_inspeccion,
      assigned_to: input.assigned_to,
      created_by: session.user.id,
      notas: input.notas?.trim() ?? null,
      estado: "pendiente",
      source: "web",
      is_voided: false,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    if (isUniqueViolation(insErr)) return actionError(DUP_MSG);
    return actionError(insErr?.message ?? "No se pudo crear la programación.");
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "mip.monitoreo_crear",
    titulo: "Monitoreo fitosanitario programado",
    detalle: {
      monitoreoId: inserted.id,
      loteCodigo: loteV.data.codigo,
      fechaInspeccion: input.fecha_inspeccion,
      assignedTo: input.assigned_to,
    },
  });

  return actionOk({ id: inserted.id });
}

export async function actualizarMonitoreoProgramado(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarMonitoreoProgramadoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ActualizarMonitoreoProgramadoInput = parsed.data;

  const fechaOk = assertFechaInspeccionRn36(input.fecha_inspeccion);
  if (!fechaOk.success) return fechaOk;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.role !== "agronomo") {
    return actionError("Sin permiso para actualizar la programación.");
  }

  const supabase = await createClient();

  const { data: prev, error: pe } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .select("id, finca_id, lote_id, estado, is_voided")
    .eq("id", input.id)
    .maybeSingle();

  if (pe || !prev) return actionError("Programación no encontrada.");
  if (prev.is_voided || prev.estado !== "pendiente") {
    return actionError("Solo se pueden editar programaciones pendientes y no anuladas.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== prev.finca_id) {
    return actionError("No puede editar programaciones de otra finca.");
  }
  if (input.finca_id !== prev.finca_id) {
    return actionError("No se permite cambiar la finca del registro.");
  }

  if (session.profile.role === "agronomo" && session.profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const loteV = await assertLoteActivoFinca(supabase, input.finca_id, input.lote_id);
  if (!loteV.success) return loteV;

  const opV = await assertOperarioAsignado(supabase, input.finca_id, input.assigned_to);
  if (!opV.success) return opV;

  const { data: updated, error: ue } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .update({
      lote_id: input.lote_id,
      fecha_inspeccion: input.fecha_inspeccion,
      assigned_to: input.assigned_to,
      notas: input.notas?.trim() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("is_voided", false)
    .eq("estado", "pendiente")
    .select("id")
    .single();

  if (ue || !updated) {
    if (isUniqueViolation(ue)) return actionError(DUP_MSG);
    return actionError(ue?.message ?? "No se pudo actualizar la programación.");
  }

  await registrarEventoFinca({
    fincaId: prev.finca_id,
    actionKey: "mip.monitoreo_actualizar",
    titulo: "Monitoreo fitosanitario actualizado",
    detalle: {
      monitoreoId: input.id,
      loteCodigo: loteV.data.codigo,
      fechaInspeccion: input.fecha_inspeccion,
      assignedTo: input.assigned_to,
    },
  });

  return actionOk({ id: updated.id });
}

export async function anularMonitoreoProgramado(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = anularMonitoreoProgramadoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.role !== "agronomo") {
    return actionError("Sin permiso para anular la programación.");
  }

  const supabase = await createClient();

  const { data: prev, error: pe } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .select("id, finca_id, lote_id, estado, is_voided")
    .eq("id", id)
    .maybeSingle();

  if (pe || !prev) return actionError("Programación no encontrada.");
  if (prev.is_voided) return actionError("La programación ya está anulada.");
  if (prev.estado === "completada") {
    return actionError("No se puede anular una inspección ya marcada como completada.");
  }
  if (!isSuperAdmin(session.profile) && session.profile.finca_id !== prev.finca_id) {
    return actionError("No puede anular programaciones de otra finca.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", prev.lote_id)
    .maybeSingle();

  const { data: updated, error: ue } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .update({
      is_voided: true,
      estado: "anulada",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (ue || !updated) {
    return actionError(ue?.message ?? "No se pudo anular la programación.");
  }

  await registrarEventoFinca({
    fincaId: prev.finca_id,
    actionKey: "mip.monitoreo_anular",
    titulo: "Monitoreo fitosanitario anulado",
    detalle: {
      monitoreoId: id,
      loteCodigo: lote?.codigo ?? null,
    },
  });

  return actionOk({ id: updated.id });
}

export async function marcarMonitoreoCompletado(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = marcarMonitoreoCompletadoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { id } = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida.");
  }
  if (session.profile.role !== "operario") {
    return actionError("Solo el operario asignado puede marcar la inspección como realizada.");
  }

  const supabase = await createClient();

  const { data: prev, error: pe } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .select("id, finca_id, lote_id, estado, is_voided")
    .eq("id", id)
    .maybeSingle();

  if (pe || !prev) return actionError("Programación no encontrada.");
  if (prev.is_voided) return actionError("La programación está anulada.");
  if (prev.estado !== "pendiente") {
    return actionError("Solo puede completar inspecciones pendientes.");
  }
  if (session.profile.finca_id !== prev.finca_id) {
    return actionError("La programación no pertenece a su finca.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", prev.lote_id)
    .maybeSingle();

  const { data: updated, error: ue } = await supabase
    .from("monitoreos_fitosanitarios_programados")
    .update({
      estado: "completada",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("assigned_to", session.user.id)
    .eq("estado", "pendiente")
    .eq("is_voided", false)
    .select("id")
    .single();

  if (ue || !updated) {
    return actionError(ue?.message ?? "No se pudo marcar como realizada.");
  }

  await registrarEventoFinca({
    fincaId: prev.finca_id,
    actionKey: "mip.monitoreo_completar",
    titulo: "Monitoreo fitosanitario completado en campo",
    detalle: {
      monitoreoId: id,
      loteCodigo: lote?.codigo ?? null,
    },
  });

  revalidatePath("/operario/sanidad/monitoreos-pendientes");
  revalidatePath("/tecnico/sanidad/programacion-monitoreos");

  return actionOk({ id: updated.id });
}