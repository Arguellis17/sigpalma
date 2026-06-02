"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, hasRole, isSuperAdmin } from "@/lib/auth/session-profile";
import { renderExpedienteRspoPdfBuffer } from "@/lib/pdf/render-expediente-rspo-pdf";
import type { ExpedienteRspoPdfData } from "@/lib/pdf/expediente-rspo-types";
import {
  validarCompletitudExpediente,
  type ExpedienteRspoAdvertencia,
} from "@/lib/trazabilidad/expediente-rspo";
import type { TrazabilidadTecnicaLotePayload } from "@/lib/trazabilidad/types";
import { getTrazabilidadTecnicaLote } from "@/app/actions/trazabilidad-lote";
import { consultarExpedienteRspoSchema } from "@/lib/validations/reporte-rspo";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

export type ExpedienteRspoPayload = {
  finca_id: string;
  finca_nombre: string;
  lote_id: string;
  trazabilidad: TrazabilidadTecnicaLotePayload;
  advertencias: ExpedienteRspoAdvertencia[];
  pdf_download_url: string;
};

async function assertAdminPuedeLote(loteId: string): Promise<
  ActionResult<{
    finca_id: string;
    finca_nombre: string;
    lote_codigo: string;
  }>
> {
  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  const { profile } = session;
  if (!hasRole(profile, ["admin", "superadmin"])) {
    return actionError("Solo administrador puede generar el expediente RSPO.");
  }

  const supabase = await createClient();
  const { data: lote, error: le } = await supabase
    .from("lotes")
    .select("id, finca_id, codigo")
    .eq("id", loteId)
    .maybeSingle();

  if (le || !lote) {
    return actionError(le?.message ?? "Lote no encontrado.");
  }

  if (!isSuperAdmin(profile)) {
    if (!profile.finca_id) {
      return actionError("Su cuenta no tiene finca asignada.");
    }
    if (profile.finca_id !== lote.finca_id) {
      return actionError("El lote no pertenece a su finca.");
    }
  }

  const { data: finca } = await supabase
    .from("fincas")
    .select("nombre")
    .eq("id", lote.finca_id)
    .maybeSingle();

  return actionOk({
    finca_id: lote.finca_id,
    finca_nombre: finca?.nombre ?? "Finca",
    lote_codigo: lote.codigo,
  });
}

export async function consultarExpedienteRspo(
  raw: unknown
): Promise<ActionResult<ExpedienteRspoPayload>> {
  const parsed = consultarExpedienteRspoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { lote_id } = parsed.data;

  const gate = await assertAdminPuedeLote(lote_id);
  if (!gate.success) return gate;

  const tr = await getTrazabilidadTecnicaLote(lote_id, { recordAudit: false });
  if (!tr.success) {
    return actionError(tr.error);
  }

  const advertencias = validarCompletitudExpediente(tr.data);

  await registrarEventoFinca({
    fincaId: gate.data.finca_id,
    actionKey: "reporte.rspo_exportar",
    titulo: "Consulta expediente RSPO",
    detalle: {
      loteId: lote_id,
      loteCodigo: gate.data.lote_codigo,
      advertencias: advertencias.map((a) => a.codigo),
      totalEventos: tr.data.eventos.length,
    },
  });

  return actionOk({
    finca_id: gate.data.finca_id,
    finca_nombre: gate.data.finca_nombre,
    lote_id,
    trazabilidad: tr.data,
    advertencias,
    pdf_download_url: `/api/v1/reportes/rspo/${lote_id}/pdf`,
  });
}

export async function buildExpedienteRspoPdfData(
  loteId: string,
  options?: { recordAudit?: boolean }
): Promise<ActionResult<ExpedienteRspoPdfData>> {
  const gate = await assertAdminPuedeLote(loteId);
  if (!gate.success) return gate;

  const tr = await getTrazabilidadTecnicaLote(loteId, { recordAudit: false });
  if (!tr.success) return tr;

  const advertencias = validarCompletitudExpediente(tr.data);

  if (options?.recordAudit !== false) {
    await registrarEventoFinca({
      fincaId: gate.data.finca_id,
      actionKey: "reporte.rspo_exportar",
      titulo: "Descarga expediente RSPO (PDF)",
      detalle: {
        loteId,
        loteCodigo: gate.data.lote_codigo,
        advertencias: advertencias.map((a) => a.codigo),
      },
    });
  }

  return actionOk({
    finca_nombre: gate.data.finca_nombre,
    lote_codigo: gate.data.lote_codigo,
    area_ha: tr.data.lote.area_ha,
    material_genetico: tr.data.lote.material_genetico,
    anio_siembra: tr.data.lote.anio_siembra,
    estado_cultivo: tr.data.lote.estado_cultivo,
    fecha_generacion: new Date().toLocaleString("es-CO"),
    advertencias,
    trazabilidad: tr.data,
  });
}

export async function exportarExpedienteRspoPdfBase64(
  loteId: string
): Promise<ActionResult<{ pdf_base64: string; filename: string }>> {
  const built = await buildExpedienteRspoPdfData(loteId);
  if (!built.success) return built;

  const buf = await renderExpedienteRspoPdfBuffer(built.data);
  const filename = `expediente-rspo-${built.data.lote_codigo}.pdf`;
  return actionOk({
    pdf_base64: buf.toString("base64"),
    filename,
  });
}
