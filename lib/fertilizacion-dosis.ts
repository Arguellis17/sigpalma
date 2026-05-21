/** RN63 HU22: umbral de desviación vs dosis programada. */
export const UMBRAL_DESVIACION_FERTILIZACION_PCT = 10;

export function calcularDesviacionPct(
  cantidadAplicada: number,
  dosisProgramada: number
): number {
  if (!Number.isFinite(cantidadAplicada) || !Number.isFinite(dosisProgramada)) {
    return 0;
  }
  if (dosisProgramada <= 0) return 0;
  const pct = (Math.abs(cantidadAplicada - dosisProgramada) / dosisProgramada) * 100;
  return Math.round(pct * 100) / 100;
}

export function requiereJustificacionDesviacion(
  cantidadAplicada: number,
  dosisProgramada: number,
  umbralPct = UMBRAL_DESVIACION_FERTILIZACION_PCT
): boolean {
  return calcularDesviacionPct(cantidadAplicada, dosisProgramada) > umbralPct;
}

export function mensajeDesviacionFertilizacion(
  cantidadAplicada: number,
  dosisProgramada: number,
  umbralPct = UMBRAL_DESVIACION_FERTILIZACION_PCT
): string | null {
  const pct = calcularDesviacionPct(cantidadAplicada, dosisProgramada);
  if (pct <= umbralPct) return null;
  const dir =
    cantidadAplicada > dosisProgramada ? "superior" : "inferior";
  return `La dosis aplicada (${cantidadAplicada}) es ${dir} a la programada (${dosisProgramada}); desviación ${pct.toFixed(1)}%. Indique una justificación técnica (RN63).`;
}

export const LABEL_DOSIS_UNIDAD_PLAN: Record<string, string> = {
  por_ha: "por hectárea",
  por_palma: "por palma",
};

export function labelDosisUnidadPlan(unidad: string): string {
  return LABEL_DOSIS_UNIDAD_PLAN[unidad] ?? unidad;
}
