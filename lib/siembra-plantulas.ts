import { estimarTotalPalmasLote } from "@/lib/censo-sanitario";

/** RN58: cantidad sembrada no puede superar palmas teóricas del lote. */
export function validarCantidadPalmasSiembra(
  cantidadPalmas: number,
  lote: {
    area_ha: number | string | null;
    densidad_palmas_ha: number | string | null;
  }
): string | null {
  if (!Number.isFinite(cantidadPalmas) || cantidadPalmas <= 0) {
    return "Indique una cantidad de palmas mayor a cero.";
  }
  const maxPalmas = estimarTotalPalmasLote(lote.area_ha, lote.densidad_palmas_ha);
  if (maxPalmas == null) {
    return "El lote no tiene área y densidad registradas para validar la cantidad sembrada.";
  }
  if (cantidadPalmas > maxPalmas) {
    return `La cantidad sembrada supera el máximo permitido para este lote (${maxPalmas} palmas).`;
  }
  return null;
}
