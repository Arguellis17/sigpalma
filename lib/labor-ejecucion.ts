import { estimarTotalPalmasLote } from "@/lib/censo-sanitario";

export const UNIDADES_MEDIDA_LABOR = ["palmas", "ha"] as const;
export type UnidadMedidaLabor = (typeof UNIDADES_MEDIDA_LABOR)[number];

export const UNIDAD_MEDIDA_LABOR_LABEL: Record<UnidadMedidaLabor, string> = {
  palmas: "Palmas",
  ha: "Hectáreas",
};

export function labelUnidadMedidaLabor(unidad: string): string {
  return UNIDAD_MEDIDA_LABOR_LABEL[unidad as UnidadMedidaLabor] ?? unidad;
}

export function formatCantidadLabor(
  cantidad: number,
  unidad: string
): string {
  const n = Number(cantidad);
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${labelUnidadMedidaLabor(unidad).toLowerCase()}`;
}

type LoteMetricas = {
  area_ha: number | string | null;
  densidad_palmas_ha: number | string | null;
};

/** RN61: cantidad ejecutada no puede superar palmas o área del lote. */
export function validarCantidadLaborVsLote(
  cantidad: number,
  unidad: UnidadMedidaLabor,
  lote: LoteMetricas
): string | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return "Indique una cantidad válida mayor a cero.";
  }

  if (unidad === "ha") {
    const area = Number(lote.area_ha);
    if (!Number.isFinite(area) || area <= 0) {
      return "El lote no tiene área registrada para validar hectáreas.";
    }
    if (cantidad > area + 1e-6) {
      return `La cantidad supera el máximo permitido para este lote (${area} ha).`;
    }
    return null;
  }

  const totalPalmas = estimarTotalPalmasLote(lote.area_ha, lote.densidad_palmas_ha);
  if (totalPalmas == null) {
    return "El lote no tiene área y densidad suficientes para validar palmas.";
  }
  if (cantidad > totalPalmas) {
    return `La cantidad supera el máximo permitido para este lote (${totalPalmas} palmas).`;
  }
  return null;
}
