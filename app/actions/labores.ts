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
      return actionError("Seleccione el tipo de labor del catálogo (RN30).");
    }
    const cat = await fetchLaborCatalogItem(supabase, input.catalogo_item_id);
    if (!cat.success) return cat;
    tipoResolved = cat.data.nombre;

    const hoy = todayColombiaYmd();
    if (input.fecha_ejecucion < hoy) {
      return actionError(
        "No se permite programar labores en fechas anteriores a la fecha actual (RN31)."
      );
    }

    const loteCheck = await assertLoteActivoProgramacion(
      supabase,
      input.lote_id,
      input.finca_id
    );
    if (!loteCheck.success) return loteCheck;
    loteCodigo = loteCheck.data.codigo;
  } else if (role === "operario") {
    catalogoItemId = null;
    const { data: loteRow } = await supabase
      .from("lotes")
      .select("codigo")
      .eq("id", input.lote_id)
      .eq("finca_id", input.finca_id)
      .maybeSingle();
    if (!loteRow) {
      return actionError("Lote no encontrado o no pertenece a la finca.");
    }
    loteCodigo = loteRow.codigo;
  } else {
    return actionError("No tiene permiso para registrar labores.");
  }

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
    return actionError("Seleccione el tipo de labor del catálogo (RN30).");
  }

  const cat = await fetchLaborCatalogItem(supabase, input.catalogo_item_id);
  if (!cat.success) return cat;
  const tipoResolved = cat.data.nombre;

  const hoy = todayColombiaYmd();
  if (input.fecha_ejecucion < hoy) {
    return actionError(
      "No se permite programar labores en fechas anteriores a la fecha actual (RN31)."
    );
  }

  const fincaId = prev.finca_id;
  const loteCheck = await assertLoteActivoProgramacion(
    supabase,
    input.lote_id,
    fincaId
  );
  if (!loteCheck.success) return loteCheck;

  const { data: updated, error: upErr } = await supabase
    .from("labores_agronomicas")
    .update({
      lote_id: input.lote_id,
      tipo: tipoResolved,
      fecha_ejecucion: input.fecha_ejecucion,
      notas: input.notas ?? null,
      catalogo_item_id: input.catalogo_item_id,
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
