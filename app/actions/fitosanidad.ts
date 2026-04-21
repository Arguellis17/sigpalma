"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, hasRole } from "@/lib/auth/session-profile";
import { isInsumoFitosanitarioProducto } from "@/lib/catalogo-insumo-fitosanitario";
import {
  cancelarOrdenControlSchema,
  registrarAplicacionFitosanitariaSchema,
  validarAlertaFitosanitariaSchema,
  type RegistrarAplicacionFitosanitariaInput,
  type ValidarAlertaFitosanitariaInput,
} from "@/lib/validations/sanidad";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

function canEmitirOrdenes(profile: {
  role: string;
  is_active: boolean | null;
  finca_id: string | null;
} | null): boolean {
  if (!profile?.is_active) return false;
  return (
    profile.role === "agronomo" ||
    profile.role === "admin" ||
    profile.role === "superadmin"
  );
}

export async function validarAlertaFitosanitaria(
  raw: unknown
): Promise<ActionResult<{ orden_id: string | null }>> {
  const parsed = validarAlertaFitosanitariaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: ValidarAlertaFitosanitariaInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user) {
    return actionError("Sesión no válida.");
  }
  const profile = session.profile;
  if (!canEmitirOrdenes(profile)) {
    return actionError("No tiene permisos para validar alertas.");
  }

  const supabase = await createClient();
  const { data: alerta, error: fetchErr } = await supabase
    .from("alertas_fitosanitarias")
    .select(
      "id, finca_id, lote_id, validacion_estado, is_voided"
    )
    .eq("id", input.alerta_id)
    .maybeSingle();

  if (fetchErr || !alerta) {
    return actionError("Alerta no encontrada.");
  }
  if (alerta.is_voided) {
    return actionError("La alerta está anulada.");
  }
  if (alerta.validacion_estado !== "pendiente") {
    return actionError("La alerta ya fue procesada.");
  }

  if (
    profile?.role !== "superadmin" &&
    profile?.finca_id &&
    alerta.finca_id !== profile.finca_id
  ) {
    return actionError("La alerta no pertenece a su finca.");
  }

  const nowIso = new Date().toISOString();
  const validacionPatch = {
    validacion_estado: input.decision,
    validacion_diagnostico: input.validacion_diagnostico.trim(),
    validado_por: session.user.id,
    validado_en: nowIso,
  };

  let ordenId: string | null = null;

  if (input.decision === "validado" && input.orden) {
    const { data: insumo, error: insumoErr } = await supabase
      .from("catalogo_items")
      .select("id, categoria, subcategoria, activo")
      .eq("id", input.orden.insumo_catalogo_id)
      .maybeSingle();

    if (insumoErr || !insumo) {
      return actionError("Insumo del catálogo no encontrado.");
    }
    if (!insumo.activo) {
      return actionError("El insumo seleccionado está inactivo.");
    }
    if (
      !isInsumoFitosanitarioProducto({
        categoria: insumo.categoria,
        subcategoria: insumo.subcategoria,
      })
    ) {
      return actionError(
        "El producto debe ser un insumo fitosanitario (subcategoría Herbicida, Fungicida, Fitosanitario, etc.; no nutrición ni herramienta)."
      );
    }

    const { data: existOrden } = await supabase
      .from("ordenes_control")
      .select("id")
      .eq("alerta_id", input.alerta_id)
      .maybeSingle();
    if (existOrden) {
      return actionError("Ya existe una orden vinculada a esta alerta.");
    }

    const { data: orden, error: ordenErr } = await supabase
      .from("ordenes_control")
      .insert({
        finca_id: alerta.finca_id,
        lote_id: alerta.lote_id,
        alerta_id: input.alerta_id,
        insumo_catalogo_id: input.orden.insumo_catalogo_id,
        dosis_recomendada: input.orden.dosis_recomendada.trim(),
        observaciones_tecnico: input.orden.observaciones_tecnico?.trim() ?? null,
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (ordenErr || !orden) {
      return actionError(ordenErr?.message ?? "No se pudo crear la orden.");
    }
    ordenId = orden.id;
  }

  const { data: updatedRows, error: upErr } = await supabase
    .from("alertas_fitosanitarias")
    .update(validacionPatch)
    .eq("id", input.alerta_id)
    .eq("validacion_estado", "pendiente")
    .select("id");

  if (upErr) {
    if (ordenId) {
      await supabase.from("ordenes_control").delete().eq("id", ordenId);
    }
    return actionError(upErr.message);
  }
  if (!updatedRows?.length) {
    if (ordenId) {
      await supabase.from("ordenes_control").delete().eq("id", ordenId);
    }
    return actionError(
      "La alerta ya no está pendiente de validación (posible duplicado)."
    );
  }

  const { data: loteInfo } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", alerta.lote_id)
    .maybeSingle();

  const decisionLabels: Record<string, string> = {
    validado: "Validada",
    rechazado: "Rechazada",
    invalidado: "Invalidada (datos insuficientes)",
  };
  const decisionLabel = decisionLabels[input.decision] ?? input.decision;

  await registrarEventoFinca({
    fincaId: alerta.finca_id,
    actionKey: "sanidad.validar_alerta",
    titulo: `Validación técnica de alerta: ${decisionLabel}`,
    detalle: {
      alertaId: input.alerta_id,
      loteCodigo: loteInfo?.codigo ?? alerta.lote_id,
      decision: input.decision,
      diagnostico: input.validacion_diagnostico.trim(),
      ordenCreadaId: ordenId,
    },
  });

  return actionOk({ orden_id: ordenId });
}

export async function cancelarOrdenControl(
  raw: unknown
): Promise<ActionResult<{ ok: true }>> {
  const parsed = cancelarOrdenControlSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const session = await getSessionProfile();
  if (!session?.user || !canEmitirOrdenes(session.profile)) {
    return actionError("No autorizado.");
  }

  const supabase = await createClient();
  const { data: orden, error: fe } = await supabase
    .from("ordenes_control")
    .select("id, finca_id, estado")
    .eq("id", parsed.data.orden_id)
    .maybeSingle();
  if (fe || !orden) return actionError("Orden no encontrada.");
  if (orden.estado !== "autorizada") {
    return actionError("Solo se pueden cancelar órdenes autorizadas pendientes de aplicación.");
  }
  const p = session.profile;
  if (p?.role !== "superadmin" && p?.finca_id !== orden.finca_id) {
    return actionError("La orden no pertenece a su finca.");
  }

  const { error } = await supabase
    .from("ordenes_control")
    .update({ estado: "cancelada", updated_at: new Date().toISOString() })
    .eq("id", orden.id);

  if (error) return actionError(error.message);

  const { data: ordenFull } = await supabase
    .from("ordenes_control")
    .select("finca_id, lote_id, id")
    .eq("id", orden.id)
    .maybeSingle();

  if (ordenFull) {
    const { data: loteInfo } = await supabase
      .from("lotes")
      .select("codigo")
      .eq("id", ordenFull.lote_id)
      .maybeSingle();
    await registrarEventoFinca({
      fincaId: ordenFull.finca_id,
      actionKey: "sanidad.cancelar_orden",
      titulo: "Cancelación de orden de control fitosanitario",
      detalle: {
        ordenId: ordenFull.id,
        loteCodigo: loteInfo?.codigo ?? ordenFull.lote_id,
      },
    });
  }

  return actionOk({ ok: true });
}

export async function registrarAplicacionFitosanitaria(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = registrarAplicacionFitosanitariaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: RegistrarAplicacionFitosanitariaInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user) {
    return actionError("Sesión no válida.");
  }
  const profile = session.profile;
  if (!hasRole(profile, ["operario", "agronomo"])) {
    return actionError("Solo operario o agrónomo pueden registrar aplicaciones.");
  }
  if (!profile?.finca_id) {
    return actionError("Su cuenta no tiene finca asignada.");
  }

  const supabase = await createClient();
  const { data: orden, error: oerr } = await supabase
    .from("ordenes_control")
    .select("id, finca_id, lote_id, insumo_catalogo_id, estado")
    .eq("id", input.orden_id)
    .maybeSingle();

  if (oerr || !orden) {
    return actionError("Orden no encontrada.");
  }
  if (orden.finca_id !== profile.finca_id) {
    return actionError("La orden no corresponde a su finca.");
  }
  if (orden.estado !== "autorizada") {
    return actionError(
      orden.estado === "cerrada"
        ? "Esta orden ya fue cerrada con una aplicación."
        : "La orden no está disponible para aplicación."
    );
  }

  const insumoId = orden.insumo_catalogo_id;

  const { data: existApp } = await supabase
    .from("aplicaciones_fitosanitarias")
    .select("id")
    .eq("orden_id", orden.id)
    .maybeSingle();
  if (existApp) {
    return actionError("Ya existe un registro de aplicación para esta orden.");
  }

  const { data: insumo, error: ierr } = await supabase
    .from("catalogo_items")
    .select("id, nombre, categoria, subcategoria, unidad_medida")
    .eq("id", insumoId)
    .maybeSingle();
  if (ierr || !insumo) {
    return actionError("Insumo de la orden no encontrado.");
  }

  const { data: row, error: insertErr } = await supabase
    .from("aplicaciones_fitosanitarias")
    .insert({
      orden_id: orden.id,
      finca_id: orden.finca_id,
      lote_id: orden.lote_id,
      catalogo_item_id: insumoId,
      fecha_aplicacion: input.fecha_aplicacion,
      cantidad_aplicada: input.cantidad_aplicada,
      unidad_medida:
        input.unidad_medida?.trim() || insumo.unidad_medida || null,
      epp_confirmado: input.epp_confirmado,
      latitud: input.latitud ?? null,
      longitud: input.longitud ?? null,
      notas: input.notas?.trim() ?? null,
      created_by: session.user.id,
      source: input.source,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return actionError(insertErr?.message ?? "No se pudo registrar la aplicación.");
  }

  const { data: loteInfo } = await supabase
    .from("lotes")
    .select("codigo")
    .eq("id", orden.lote_id)
    .maybeSingle();

  await registrarEventoFinca({
    fincaId: orden.finca_id,
    actionKey: "sanidad.aplicacion_fitosanitaria",
    titulo: "Aplicación fitosanitaria registrada",
    detalle: {
      aplicacionId: row.id,
      ordenId: orden.id,
      loteCodigo: loteInfo?.codigo ?? orden.lote_id,
      insumoNombre: insumo.nombre,
      fechaAplicacion: input.fecha_aplicacion,
      cantidad: input.cantidad_aplicada,
      unidad: input.unidad_medida?.trim() || insumo.unidad_medida || null,
      eppConfirmado: input.epp_confirmado,
      notas: input.notas?.trim() ?? null,
      coordenadas:
        input.latitud != null && input.longitud != null
          ? `${input.latitud}, ${input.longitud}`
          : null,
    },
  });

  return actionOk({ id: row.id });
}
