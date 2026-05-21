/** Umbral por defecto cuando el catálogo no define umbral económico por amenaza (HU24 escenario 1). */
export const UMBRAL_INCIDENCIA_CENSO_PCT = 10;

export function calcularIncidenciaPct(
  palmasInspeccionadas: number,
  palmasAfectadas: number
): number {
  if (palmasInspeccionadas <= 0) return 0;
  const pct = (palmasAfectadas / palmasInspeccionadas) * 100;
  return Math.round(pct * 100) / 100;
}

export function estimarTotalPalmasLote(
  areaHa: number | string | null | undefined,
  densidadPalmasHa: number | string | null | undefined
): number | null {
  const area = Number(areaHa);
  const densidad = Number(densidadPalmasHa);
  if (!Number.isFinite(area) || area <= 0) return null;
  if (!Number.isFinite(densidad) || densidad <= 0) return null;
  return Math.round(area * densidad);
}

export function superaUmbralIncidencia(incidenciaPct: number): boolean {
  return incidenciaPct >= UMBRAL_INCIDENCIA_CENSO_PCT;
}

export function labelIncidenciaPct(pct: number): string {
  return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
}
