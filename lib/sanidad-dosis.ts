/** Extrae la primera cantidad numérica de una dosis recomendada (ej. "2.5 L/ha" → 2.5). */
export function parseCantidadDosis(text: string): number | null {
  const m = text.trim().match(/([\d]+[.,]?\d*)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** HU23: bloquea si la cantidad aplicada supera la dosis ordenada en más de maxDesviacionPct. */
export function excedeDesviacionDosisAutorizada(
  cantidadAplicada: number,
  dosisRecomendadaTexto: string,
  maxDesviacionPct = 20
): boolean {
  const recomendada = parseCantidadDosis(dosisRecomendadaTexto);
  if (recomendada === null) return false;
  return cantidadAplicada > recomendada * (1 + maxDesviacionPct / 100);
}

export function mensajeDesviacionDosis(
  cantidadAplicada: number,
  dosisRecomendadaTexto: string,
  maxDesviacionPct = 20
): string | null {
  const recomendada = parseCantidadDosis(dosisRecomendadaTexto);
  if (recomendada === null) return null;
  if (!excedeDesviacionDosisAutorizada(cantidadAplicada, dosisRecomendadaTexto, maxDesviacionPct)) {
    return null;
  }
  const maxPermitida = recomendada * (1 + maxDesviacionPct / 100);
  return `La cantidad aplicada (${cantidadAplicada}) supera en más del ${maxDesviacionPct}% la dosis autorizada (${recomendada}; máximo ${maxPermitida.toFixed(2)}).`;
}
