import type { TrazabilidadTecnicaLotePayload } from "@/lib/trazabilidad/types";

export type ExpedienteCompletitudFlag =
  | "sin_plan_siembra"
  | "sin_siembra"
  | "sin_cosecha"
  | "sin_despacho"
  | "sin_sanidad"
  | "sin_nutricion";

export type ExpedienteRspoAdvertencia = {
  codigo: ExpedienteCompletitudFlag;
  mensaje: string;
};

export function validarCompletitudExpediente(
  payload: TrazabilidadTecnicaLotePayload
): ExpedienteRspoAdvertencia[] {
  const { resumen, eventos } = payload;
  const adv: ExpedienteRspoAdvertencia[] = [];

  if (resumen.conteoPorCategoria.material_plan === 0) {
    adv.push({
      codigo: "sin_plan_siembra",
      mensaje: "Sin plan o material genético de siembra registrado.",
    });
  }
  if (
    resumen.conteoPorCategoria.material_plan > 0 &&
    resumen.conteoPorCategoria.labor === 0 &&
    resumen.conteoPorCategoria.cosecha === 0
  ) {
    adv.push({
      codigo: "sin_siembra",
      mensaje: "No hay registro de siembra o labores posteriores en el lote.",
    });
  }
  if (resumen.conteoPorCategoria.cosecha === 0) {
    adv.push({
      codigo: "sin_cosecha",
      mensaje: "Sin registros de cosecha RFF en la ruta técnica.",
    });
  }
  if (resumen.conteoPorCategoria.logistica === 0 && resumen.cosechasEnLote > 0) {
    adv.push({
      codigo: "sin_despacho",
      mensaje:
        "Hay cosecha registrada pero no consta remisión de despacho (RN25). Genere remisión HU29.",
    });
  }
  if (resumen.conteoPorCategoria.sanidad === 0) {
    adv.push({
      codigo: "sin_sanidad",
      mensaje: "Sin eventos de sanidad (alertas, censos o aplicaciones) en el periodo.",
    });
  }
  if (resumen.conteoPorCategoria.nutricion === 0) {
    adv.push({
      codigo: "sin_nutricion",
      mensaje: "Sin planes o aplicaciones de nutrición registrados.",
    });
  }

  const tieneEventosUtiles = eventos.some(
    (e) => e.category !== "suelo" || resumen.conteoPorCategoria.suelo > 0
  );
  if (!tieneEventosUtiles && adv.length === 0) {
    adv.push({
      codigo: "sin_plan_siembra",
      mensaje: "Expediente con datos insuficientes para certificación RSPO.",
    });
  }

  return adv;
}
