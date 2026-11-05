"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { todayColombiaYmd } from "@/lib/date-colombia";
import { assertOperarioAsignadoFinca } from "@/lib/operario-finca";
import { isUniqueViolation } from "@/lib/postgres-errors";
import type { FrecuenciaCronograma } from "@/lib/cronogramas";
import {
  actualizarCronogramaSchema,
  anularCronogramaSchema,
  cambiarEstadoCronogramaSchema,
  crearCronogramaSchema,
  type CrearCronogramaInput,
} from "@/lib/validations/cronograma";
import { registrarEventoFinca } from "./audit";
import { actionError, actionOk, type ActionResult } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CronogramaRow = {
  id: string;
  lote_id: string;
  lote_codigo: string;
  catalogo_item_id: string;
  labor_nombre: string;
  assigned_to: string;
  operario_nombre: string;
  frecuencia: FrecuenciaCronograma;
  intervalo: number;
  dias_semana: number[];
  fecha_inicio: string;
  fecha_fin: string | null;
  notas: string | null;
  activo: boolean;
  /** Motivo por el que un cronograma activo no está generando labores. */
  detenido_por: string | null;
};

const DUPLICADO = "Ya existe un cronograma activo para esta labor en este lote. Edítelo o páuselo primero.";
const RUTAS = ["/tecnico/cronogramas", "/tecnico/agenda"];

function primerError(parsed: { error: { issues: { message: string }[] } }) {
  return parsed.error.issues.map((i) => i.message).join("; ");
}

/** Sesión de agrónomo con finca asignada: el planificador agrícola de CR-05. */
async function sesionPlanificador(): Promise<ActionResult<{ userId: string; fincaId: string; supabase: Supabase }>> {
  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }
  if (session.profile.role !== "agronomo" || !session.profile.finca_id) {
    return actionError("Solo el técnico agrónomo puede configurar cronogramas de labores.");
  }
  return actionOk({ userId: session.user.id, fincaId: session.profile.finca_id, supabase: await createClient() });
}

/** Comprueba lote, labor y operario; devuelve los nombres para la auditoría. */
async function validarReferencias(
  supabase: Supabase,
  input: CrearCronogramaInput
): Promise<ActionResult<{ loteCodigo: string; laborNombre: string }>> {
  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo, activo, finca_id")
    .eq("id", input.lote_id)
    .maybeSingle();
  if (!lote || lote.finca_id !== input.finca_id) return actionError("El lote no pertenece a su finca.");
  if (!lote.activo) return actionError("El lote seleccionado no está activo.");

  const { data: labor } = await supabase
    .from("catalogo_items")
    .select("nombre, categoria, activo")
    .eq("id", input.catalogo_item_id)
    .maybeSingle();
  if (!labor || labor.categoria !== "labor" || !labor.activo) {
    return actionError("Seleccione un tipo de labor válido del catálogo.");
  }

  const operario = await assertOperarioAsignadoFinca(supabase, input.finca_id, input.assigned_to);
  if (!operario.success) return operario;

  return actionOk({ loteCodigo: lote.codigo, laborNombre: labor.nombre });
}

/** Anula las labores futuras aún sin ejecutar; lo ya ejecutado no se toca. */
async function anularFuturas(supabase: Supabase, cronogramaId: string) {
  return supabase
    .from("labores_agronomicas")
    .update({ is_voided: true })
    .eq("cronograma_id", cronogramaId)
    .eq("is_voided", false)
    .is("cantidad_ejecutada", null)
    .gte("fecha_ejecucion", todayColombiaYmd());
}

async function generar(supabase: Supabase, cronogramaId: string): Promise<ActionResult<number>> {
  const { data, error } = await supabase.rpc("generar_labores_cronogramas", { p_cronograma_id: cronogramaId });
  if (error) return actionError(error.message);
  return actionOk(data ?? 0);
}

function revalidar() {
  RUTAS.forEach((r) => revalidatePath(r));
}

export async function listarCronogramas(fincaId: string): Promise<ActionResult<CronogramaRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cronogramas_labores")
    .select(
      "id, lote_id, catalogo_item_id, assigned_to, frecuencia, intervalo, dias_semana, fecha_inicio, fecha_fin, notas, activo, lotes ( codigo, activo ), catalogo_items ( nombre, activo ), operario:profiles!cronogramas_labores_assigned_to_fkey ( full_name, is_active, finca_id )"
    )
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("created_at", { ascending: false });
  if (error) return actionError(error.message);

  type Fila = {
    id: string;
    lote_id: string;
    catalogo_item_id: string;
    assigned_to: string;
    frecuencia: FrecuenciaCronograma;
    intervalo: number;
    dias_semana: number[];
    fecha_inicio: string;
    fecha_fin: string | null;
    notas: string | null;
    activo: boolean;
    lotes: { codigo: string; activo: boolean } | null;
    catalogo_items: { nombre: string; activo: boolean } | null;
    operario: { full_name: string | null; is_active: boolean; finca_id: string | null } | null;
  };

  return actionOk(
    ((data ?? []) as unknown as Fila[]).map((f) => ({
      id: f.id,
      lote_id: f.lote_id,
      lote_codigo: f.lotes?.codigo ?? "—",
      catalogo_item_id: f.catalogo_item_id,
      labor_nombre: f.catalogo_items?.nombre ?? "—",
      assigned_to: f.assigned_to,
      operario_nombre: f.operario?.full_name || "Operario",
      frecuencia: f.frecuencia,
      intervalo: f.intervalo,
      dias_semana: f.dias_semana,
      fecha_inicio: f.fecha_inicio,
      fecha_fin: f.fecha_fin,
      notas: f.notas,
      activo: f.activo,
      detenido_por: !f.lotes?.activo
        ? "El lote está inactivo"
        : !f.catalogo_items?.activo
          ? "La labor está inactiva en el catálogo"
          : !f.operario?.is_active || f.operario.finca_id !== fincaId
            ? "El operario ya no está activo en la finca"
            : null,
    }))
  );
}

export async function crearCronograma(raw: unknown): Promise<ActionResult<{ id: string; generadas: number }>> {
  const parsed = crearCronogramaSchema.safeParse(raw);
  if (!parsed.success) return actionError(primerError(parsed));
  const input = parsed.data;

  const sesion = await sesionPlanificador();
  if (!sesion.success) return sesion;
  const { supabase, userId, fincaId } = sesion.data;
  if (input.finca_id !== fincaId) return actionError("La finca no coincide con su asignación.");
  if (input.fecha_inicio < todayColombiaYmd()) {
    return actionError("La fecha de inicio no puede ser anterior a hoy.");
  }

  const refs = await validarReferencias(supabase, input);
  if (!refs.success) return refs;

  const { data, error } = await supabase
    .from("cronogramas_labores")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      catalogo_item_id: input.catalogo_item_id,
      assigned_to: input.assigned_to,
      frecuencia: input.frecuencia,
      intervalo: input.intervalo,
      dias_semana: input.frecuencia === "semanal" ? input.dias_semana : [],
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin ?? null,
      notas: input.notas?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return actionError(isUniqueViolation(error) ? DUPLICADO : error.message);

  const generadas = await generar(supabase, data.id);
  if (!generadas.success) return generadas;

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "cronograma.crear",
    titulo: "Cronograma de labor recurrente creado",
    detalle: {
      cronogramaId: data.id,
      loteCodigo: refs.data.loteCodigo,
      tipoLabor: refs.data.laborNombre,
      frecuencia: input.frecuencia,
      intervalo: input.intervalo,
      diasSemana: input.dias_semana,
      fechaInicio: input.fecha_inicio,
      fechaFin: input.fecha_fin ?? null,
      assignedTo: input.assigned_to,
      laboresGeneradas: generadas.data,
    },
  });
  revalidar();
  return actionOk({ id: data.id, generadas: generadas.data });
}

export async function actualizarCronograma(raw: unknown): Promise<ActionResult<{ id: string; generadas: number }>> {
  const parsed = actualizarCronogramaSchema.safeParse(raw);
  if (!parsed.success) return actionError(primerError(parsed));
  const input = parsed.data;

  const sesion = await sesionPlanificador();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;
  if (input.finca_id !== fincaId) return actionError("La finca no coincide con su asignación.");

  const { data: actual } = await supabase
    .from("cronogramas_labores")
    .select("fecha_inicio, activo, is_voided, finca_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!actual || actual.finca_id !== fincaId || actual.is_voided) return actionError("Cronograma no encontrado.");
  if (input.fecha_inicio !== actual.fecha_inicio && input.fecha_inicio < todayColombiaYmd()) {
    return actionError("La fecha de inicio no puede ser anterior a hoy.");
  }

  const refs = await validarReferencias(supabase, input);
  if (!refs.success) return refs;

  const { error } = await supabase
    .from("cronogramas_labores")
    .update({
      lote_id: input.lote_id,
      catalogo_item_id: input.catalogo_item_id,
      assigned_to: input.assigned_to,
      frecuencia: input.frecuencia,
      intervalo: input.intervalo,
      dias_semana: input.frecuencia === "semanal" ? input.dias_semana : [],
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin ?? null,
      notas: input.notas?.trim() || null,
      generado_hasta: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return actionError(isUniqueViolation(error) ? DUPLICADO : error.message);

  // La regla cambió: las labores futuras pendientes se reemplazan por las de la regla nueva.
  const anuladas = await anularFuturas(supabase, input.id);
  if (anuladas.error) return actionError(anuladas.error.message);

  const generadas = actual.activo ? await generar(supabase, input.id) : actionOk(0);
  if (!generadas.success) return generadas;

  await registrarEventoFinca({
    fincaId,
    actionKey: "cronograma.actualizar",
    titulo: "Cronograma de labor recurrente actualizado",
    detalle: {
      cronogramaId: input.id,
      loteCodigo: refs.data.loteCodigo,
      tipoLabor: refs.data.laborNombre,
      frecuencia: input.frecuencia,
      intervalo: input.intervalo,
      diasSemana: input.dias_semana,
      fechaInicio: input.fecha_inicio,
      fechaFin: input.fecha_fin ?? null,
      assignedTo: input.assigned_to,
      laboresGeneradas: generadas.data,
    },
  });
  revalidar();
  return actionOk({ id: input.id, generadas: generadas.data });
}

/** Pausar anula las labores futuras pendientes; reanudar las genera de nuevo desde hoy. */
export async function cambiarEstadoCronograma(raw: unknown): Promise<ActionResult<{ id: string; generadas: number }>> {
  const parsed = cambiarEstadoCronogramaSchema.safeParse(raw);
  if (!parsed.success) return actionError(primerError(parsed));
  const { id, activo } = parsed.data;

  const sesion = await sesionPlanificador();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;

  const { error, count } = await supabase
    .from("cronogramas_labores")
    .update({ activo, generado_hasta: null, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .eq("finca_id", fincaId)
    .eq("is_voided", false);
  if (error) return actionError(isUniqueViolation(error) ? DUPLICADO : error.message);
  if (!count) return actionError("Cronograma no encontrado.");

  if (!activo) {
    const anuladas = await anularFuturas(supabase, id);
    if (anuladas.error) return actionError(anuladas.error.message);
  }
  const generadas = activo ? await generar(supabase, id) : actionOk(0);
  if (!generadas.success) return generadas;

  await registrarEventoFinca({
    fincaId,
    actionKey: "cronograma.actualizar",
    titulo: activo ? "Cronograma de labor reanudado" : "Cronograma de labor pausado",
    detalle: { cronogramaId: id, activo, laboresGeneradas: generadas.data },
  });
  revalidar();
  return actionOk({ id, generadas: generadas.data });
}

export async function anularCronograma(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = anularCronogramaSchema.safeParse(raw);
  if (!parsed.success) return actionError(primerError(parsed));
  const { id } = parsed.data;

  const sesion = await sesionPlanificador();
  if (!sesion.success) return sesion;
  const { supabase, fincaId } = sesion.data;

  const { error, count } = await supabase
    .from("cronogramas_labores")
    .update({ is_voided: true, activo: false, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .eq("finca_id", fincaId)
    .eq("is_voided", false);
  if (error) return actionError(error.message);
  if (!count) return actionError("Cronograma no encontrado.");

  const anuladas = await anularFuturas(supabase, id);
  if (anuladas.error) return actionError(anuladas.error.message);

  await registrarEventoFinca({
    fincaId,
    actionKey: "cronograma.anular",
    titulo: "Cronograma de labor anulado",
    detalle: { cronogramaId: id },
  });
  revalidar();
  return actionOk({ id });
}
