"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { todayColombiaYmd } from "@/lib/date-colombia";
import {
  actualizarLaborSchema,
  anularRegistroCampoSchema,
  registrarLaborSchema,
  type ActualizarLaborInput,
  type RegistrarLaborInput,
} from "@/lib/validations/operativo";
import {
  registrarLaborEjecutadaSchema,
  type RegistrarLaborEjecutadaInput,
} from "@/lib/validations/labor-ejecucion";
import {
  validarCantidadLaborVsLote,
  type UnidadMedidaLabor,
} from "@/lib/labor-ejecucion";
import { assertOperarioAsignadoFinca } from "@/lib/operario-finca";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

async function fetchLaborCatalogItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogoItemId: string
): Promise<ActionResult<{ nombre: string }>> {
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("nombre, categoria, activo")
    .eq("id", catalogoItemId)
    .maybeSingle();

  if (error || !data) {
    return actionError("Ítem de catálogo no encontrado.");
  }
  if (data.categoria !== "labor" || !data.activo) {
    return actionError("Seleccione un tipo de labor válido del catálogo.");
  }
  return actionOk({ nombre: data.nombre });
}

async function assertLoteActivoProgramacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loteId: string,
  fincaId: string
): Promise<ActionResult<{ codigo: string }>> {
  const { data, error } = await supabase
    .from("lotes")
    .select("codigo, activo, finca_id")
    .eq("id", loteId)
    .maybeSingle();

  if (error || !data) {
    return actionError("Lote no encontrado.");
  }
  if (data.finca_id !== fincaId) {
    return actionError("El lote no pertenece a la finca seleccionada.");
  }
  if (!data.activo) {
    return actionError(
      "Operación no permitida: el lote seleccionado no se encuentra activo."
    );
  }
  return actionOk({ codigo: data.codigo });
}

async function assertLoteEjecutableLabor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loteId: string,
  fincaId: string
): Promise<
  ActionResult<{
    codigo: string;
    area_ha: number;
    densidad_palmas_ha: number | null;
  }>
> {
  const { data, error } = await supabase
    .from("lotes")
    .select("codigo, activo, finca_id, estado_cultivo, area_ha, densidad_palmas_ha")
    .eq("id", loteId)
    .maybeSingle();

  if (error || !data) {
    return actionError("Lote no encontrado.");
  }
  if (data.finca_id !== fincaId) {
    return actionError("El lote no pertenece a la finca seleccionada.");
  }
  if (!data.activo) {
    return actionError(
      "Operación no permitida: el lote seleccionado no se encuentra activo."
    );
  }
  if (data.estado_cultivo !== "en_produccion") {
    return actionError(
      "Solo se pueden registrar labores en lotes en producción."
    );
  }
  return actionOk({
    codigo: data.codigo,
    area_ha: Number(data.area_ha),
    densidad_palmas_ha:
      data.densidad_palmas_ha != null ? Number(data.densidad_palmas_ha) : null,
  });
}

export async function registrarLabor(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarLaborSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarLaborInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }
  const { profile, user } = session;
  const role = profile.role;

  if (profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();

  let tipoResolved = input.tipo.trim() || "Labor";
  let catalogoItemId: string | null = input.catalogo_item_id ?? null;
  let loteCodigo: string;

  if (role === "agronomo") {
    if (!input.catalogo_item_id) {
      return actionError("Seleccione el tipo de labor del catálogo.");
    }
    const cat = await fetchLaborCatalogItem(supabase, input.catalogo_item_id);
    if (!cat.success) return cat;
    tipoResolved = cat.data.nombre;

    const hoy = todayColombiaYmd();
    if (input.fecha_ejecucion < hoy) {
      return actionError(
        "No se permite programar labores en fechas anteriores a la fecha actual."
      );
    }

    const loteCheck = await assertLoteActivoProgramacion(
      supabase,
      input.lote_id,
      input.finca_id
    );
    if (!loteCheck.success) return loteCheck;
    loteCodigo = loteCheck.data.codigo;

    const opV = await assertOperarioAsignadoFinca(
      supabase,
      input.finca_id,
      input.assigned_to
    );
    if (!opV.success) return opV;
  } else {
    return actionError("No tiene permiso para programar labores.");
  }

  const { data, error } = await supabase
    .from("labores_agronomicas")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      tipo: tipoResolved,
      fecha_ejecucion: input.fecha_ejecucion,
      notas: input.notas ?? null,
      assigned_to: input.assigned_to,
      created_by: user.id,
      source: input.source,
      catalogo_item_id: catalogoItemId,
    })
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "labor.registrar",
    titulo: "Registro de labor agronómica",
    detalle: {
      registroId: data.id,
      loteCodigo,
      tipoLabor: tipoResolved,
      fechaEjecucion: input.fecha_ejecucion,
      notas: input.notas ?? null,
      catalogoItemId,
      assignedTo: input.assigned_to,
    },
  });

  return actionOk({ id: data.id });
}

export async function registrarLaborEjecutada(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarLaborEjecutadaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarLaborEjecutadaInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active || !session.user) {
    return actionError("Sesión no válida. Inicie sesión nuevamente.");
  }
  const { profile, user } = session;
  if (profile.role !== "operario" && !isSuperAdmin(profile)) {
    return actionError("Solo el operario de campo puede registrar ejecución de labores.");
  }
  if (profile.finca_id !== input.finca_id) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();
  const ejecutadaAt = new Date().toISOString();

  const cat = await fetchLaborCatalogItem(supabase, input.catalogo_item_id);
  if (!cat.success) return cat;
  const tipoResolved = cat.data.nombre;

  if (input.labor_programada_id) {
    const { data: programada, error: progErr } = await supabase
      .from("labores_agronomicas")
      .select(
        "id, finca_id, lote_id, tipo, fecha_ejecucion, notas, catalogo_item_id, cantidad_ejecutada, is_voided, assigned_to"
      )
      .eq("id", input.labor_programada_id)
      .maybeSingle();

    if (progErr || !programada) {
      return actionError(progErr?.message ?? "Labor programada no encontrada.");
    }
    if (programada.is_voided) {
      return actionError("La labor programada está anulada.");
    }
    if (programada.finca_id !== input.finca_id) {
      return actionError("La labor programada no pertenece a su finca.");
    }
    if (
      programada.assigned_to != null &&
      programada.assigned_to !== user.id
    ) {
      return actionError("Esta labor está asignada a otro operario.");
    }
    if (programada.cantidad_ejecutada != null) {
      return actionError("Esta labor ya fue reportada como ejecutada.");
    }
    if (programada.catalogo_item_id !== input.catalogo_item_id) {
      return actionError("El tipo de labor no coincide con la programación.");
    }

    const loteCheck = await assertLoteEjecutableLabor(
      supabase,
      programada.lote_id,
      input.finca_id
    );
    if (!loteCheck.success) return loteCheck;

    const rn61 = validarCantidadLaborVsLote(
      input.cantidad_ejecutada,
      input.unidad_medida as UnidadMedidaLabor,
      loteCheck.data
    );
    if (rn61) return actionError(rn61);

    const notasMerged =
      input.notas?.trim() ||
      programada.notas?.trim() ||
      null;

    const { data: updated, error: upErr } = await supabase
      .from("labores_agronomicas")
      .update({
        cantidad_ejecutada: input.cantidad_ejecutada,
        unidad_medida: input.unidad_medida,
        ejecutada_at: ejecutadaAt,
        fecha_ejecucion: input.fecha_ejecucion,
        notas: notasMerged,
        updated_at: ejecutadaAt,
      })
      .eq("id", input.labor_programada_id)
      .is("cantidad_ejecutada", null)
      .eq("is_voided", false)
      .select("id, lote_id")
      .single();

    if (upErr || !updated) {
      return actionError(upErr?.message ?? "No se pudo completar la labor programada.");
    }

    await registrarEventoFinca({
      fincaId: input.finca_id,
      actionKey: "labor.ejecutar",
      titulo: "Ejecución de labor agronómica",
      detalle: {
        registroId: updated.id,
        loteCodigo: loteCheck.data.codigo,
        tipoLabor: tipoResolved,
        cantidadEjecutada: input.cantidad_ejecutada,
        unidadMedida: input.unidad_medida,
        fechaEjecucion: input.fecha_ejecucion,
        ejecutadaAt,
        laborProgramadaId: input.labor_programada_id,
        notas: notasMerged,
        catalogoItemId: input.catalogo_item_id,
      },
    });

    return actionOk({ id: updated.id });
  }

  const loteCheck = await assertLoteEjecutableLabor(
    supabase,
    input.lote_id,
    input.finca_id
  );
  if (!loteCheck.success) return loteCheck;

  const rn61 = validarCantidadLaborVsLote(
    input.cantidad_ejecutada,
    input.unidad_medida as UnidadMedidaLabor,
    loteCheck.data
  );
  if (rn61) return actionError(rn61);

  const { data, error } = await supabase
    .from("labores_agronomicas")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      tipo: tipoResolved,
      fecha_ejecucion: input.fecha_ejecucion,
      notas: input.notas ?? null,
      created_by: user.id,
      source: input.source,
      catalogo_item_id: input.catalogo_item_id,
      cantidad_ejecutada: input.cantidad_ejecutada,
      unidad_medida: input.unidad_medida,
      ejecutada_at: ejecutadaAt,
    })
    .select("id")
    .single();

  if (error) {
    return actionError(error.message);
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "labor.ejecutar",
    titulo: "Ejecución de labor agronómica",
    detalle: {
      registroId: data.id,
      loteCodigo: loteCheck.data.codigo,
      tipoLabor: tipoResolved,
      cantidadEjecutada: input.cantidad_ejecutada,
      unidadMedida: input.unidad_medida,
      fechaEjecucion: input.fecha_ejecucion,
      ejecutadaAt,
      notas: input.notas ?? null,
      catalogoItemId: input.catalogo_item_id,
    },
  });

  return actionOk({ id: data.id });
}

export async function actualizarLabor(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = actualizarLaborSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ActualizarLaborInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no encontrada.");
  }
  const { profile } = session;
  if (profile.role !== "agronomo" && !isSuperAdmin(profile)) {
    return actionError("Solo el técnico agrónomo puede modificar la programación.");
  }

  const supabase = await createClient();

  const { data: prev, error: prevErr } = await supabase
    .from("labores_agronomicas")
    .select(
      "id, finca_id, lote_id, tipo, fecha_ejecucion, notas, catalogo_item_id, is_voided"
    )
    .eq("id", input.id)
    .maybeSingle();

  if (prevErr || !prev) {
    return actionError(prevErr?.message ?? "Labor no encontrada.");
  }
  if (prev.is_voided) {
    return actionError("No se puede editar una labor anulada.");
  }

  if (!isSuperAdmin(profile) && profile.finca_id !== prev.finca_id) {
    return actionError("No puede modificar registros de otra finca.");
  }

  if (!input.catalogo_item_id) {
    return actionError("Seleccione el tipo de labor del catálogo.");
  }

  const cat = await fetchLaborCatalogItem(supabase, input.catalogo_item_id);
  if (!cat.success) return cat;
  const tipoResolved = cat.data.nombre;

  const hoy = todayColombiaYmd();
  if (input.fecha_ejecucion < hoy) {
    return actionError(
      "No se permite programar labores en fechas anteriores a la fecha actual."
    );
  }

  const fincaId = prev.finca_id;
  const loteCheck = await assertLoteActivoProgramacion(
    supabase,
    input.lote_id,
    fincaId
  );
  if (!loteCheck.success) return loteCheck;

  const opV = await assertOperarioAsignadoFinca(
    supabase,
    fincaId,
    input.assigned_to
  );
  if (!opV.success) return opV;

  const { data: updated, error: upErr } = await supabase
    .from("labores_agronomicas")
    .update({
      lote_id: input.lote_id,
      tipo: tipoResolved,
      fecha_ejecucion: input.fecha_ejecucion,
      notas: input.notas ?? null,
      catalogo_item_id: input.catalogo_item_id,
      assigned_to: input.assigned_to,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("is_voided", false)
    .select("id")
    .single();

  if (upErr || !updated) {
    return actionError(upErr?.message ?? "No se pudo actualizar la labor.");
  }

  await registrarEventoFinca({
    fincaId,
    actionKey: "labor.actualizar",
    titulo: "Actualización de labor programada",
    detalle: {
      registroId: input.id,
      anterior: {
        loteId: prev.lote_id,
        tipo: prev.tipo,
        fechaEjecucion: prev.fecha_ejecucion,
        notas: prev.notas,
        catalogoItemId: prev.catalogo_item_id,
      },
      nuevo: {
        loteId: input.lote_id,
        tipo: tipoResolved,
        fechaEjecucion: input.fecha_ejecucion,
        notas: input.notas ?? null,
        catalogoItemId: input.catalogo_item_id,
        assignedTo: input.assigned_to,
      },
    },
  });

  return actionOk({ id: updated.id });
}

export async function anularLabor(
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
    return actionError("No tienes permiso para anular labores.");
  }

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("labores_agronomicas")
    .select("id, finca_id, is_voided")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return actionError(fetchErr?.message ?? "Labor no encontrada.");
  }
  if (row.is_voided) {
    return actionError("Esta labor ya está anulada.");
  }
  if (!isSuperAdmin(profile) && profile.finca_id !== row.finca_id) {
    return actionError("No puede anular registros de otra finca.");
  }

  const { data, error } = await supabase
    .from("labores_agronomicas")
    .update({ is_voided: true })
    .eq("id", id)
    .eq("is_voided", false)
    .select("id, finca_id, lote_id, tipo, fecha_ejecucion")
    .single();

  if (error || !data) {
    return actionError(error?.message ?? "No se pudo anular la labor.");
  }

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", data.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: data.finca_id,
    actionKey: "labor.anular",
    titulo: "Anulación de labor agronómica",
    detalle: {
      registroId: data.id,
      loteCodigo: lote?.codigo ?? data.lote_id,
      tipoLabor: data.tipo,
      fechaEjecucion: data.fecha_ejecucion,
    },
  });

  return actionOk({ id: data.id });
}
