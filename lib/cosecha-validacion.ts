/** HU27: reglas de negocio para registro de cosecha RFF. */

export const EDAD_MINIMA_COSECHA_ANIOS = 3;
export const PESO_INUSUAL_UMBRAL_RATIO = 1.2;

/** Nombres de catálogo labor que habilitan cosecha (HU11). */
export const LABOR_COSECHA_NOMBRES = ["cosecha rff", "cosecha"] as const;

export function esNombreLaborCosecha(nombre: string): boolean {
  const n = nombre.trim().toLowerCase();
  return (
    LABOR_COSECHA_NOMBRES.some((key) => n === key) ||
    n.includes("cosecha rff") ||
    n === "cosecha"
  );
}

export type LoteCosechaInput = {
  activo: boolean;
  estado_cultivo: string;
  anio_siembra: number | null;
};

export function edadCultivoAnios(
  anioSiembra: number | null,
  fechaCosechaYmd: string
): number | null {
  if (anioSiembra == null || !Number.isFinite(anioSiembra)) {
    return null;
  }
  const year = Number.parseInt(fechaCosechaYmd.slice(0, 4), 10);
  if (!Number.isFinite(year)) return null;
  return year - anioSiembra;
}

export function loteAptoParaCosecha(
  lote: LoteCosechaInput,
  fechaCosechaYmd: string
): { ok: true } | { ok: false; error: string } {
  if (!lote.activo) {
    return { ok: false, error: "El lote no está activo." };
  }
  if (lote.estado_cultivo !== "en_produccion") {
    return {
      ok: false,
      error:
        "Solo se puede cosechar en lotes en producción. Complete la siembra (HU20) o verifique el estado del lote.",
    };
  }
  const edad = edadCultivoAnios(lote.anio_siembra, fechaCosechaYmd);
  if (edad === null) {
    return {
      ok: false,
      error:
        "El lote no tiene año de siembra registrado. Actualice el lote antes de cosechar (RN78).",
    };
  }
  if (edad < EDAD_MINIMA_COSECHA_ANIOS) {
    return {
      ok: false,
      error:
        "Lote en etapa de levante: no apto para cosecha comercial (menos de 3 años desde la siembra, RN78).",
    };
  }
  return { ok: true };
}

export function pesoEsInusual(
  pesoKg: number,
  maxHistoricoKg: number | null
): boolean {
  if (maxHistoricoKg == null || maxHistoricoKg <= 0) {
    return false;
  }
  return pesoKg > maxHistoricoKg * PESO_INUSUAL_UMBRAL_RATIO;
}

export function mensajePesoInusual(
  pesoKg: number,
  maxHistoricoKg: number
): string {
  return `Peso inusual detectado (${pesoKg.toLocaleString("es-CO")} kg vs máximo histórico ${maxHistoricoKg.toLocaleString("es-CO")} kg). Verifique la báscula antes de confirmar.`;
}

type LaborCosechaRow = {
  catalogo_items: { nombre: string } | null;
};

/** HU11: debe existir labor de cosecha programada y pendiente de ejecución. */
export function filasIncluyenLaborCosechaPendiente(
  labores: LaborCosechaRow[]
): boolean {
  return labores.some((l) => {
    const nombre = l.catalogo_items?.nombre;
    return nombre != null && esNombreLaborCosecha(nombre);
  });
}
