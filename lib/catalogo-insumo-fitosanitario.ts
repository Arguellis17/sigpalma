/**
 * RN13 / RN65 (LINEAMIENTO): insumos se clasifican en nutrición, fitosanitario u herramienta.
 * En `catalogo_items` usamos categoria = 'insumo' y `subcategoria` en texto libre.
 * Para fitosanitarios (órdenes de control, aplicaciones RF23) aceptamos:
 * - subcategoría explícita "fitosanitario" / "agroquímico" / variantes, o
 * - términos típicos de plaguicida (herbicida, fungicida, insecticida, etc.)
 * Excluimos explícitamente nutrición/fertilizante y herramienta.
 */
const NUTRICION_TOKENS = [
  "nutrición",
  "nutricion",
  "fertilizante",
  "nutriente",
  "urea",
  "abono",
];

const HERRAMIENTA_TOKENS = ["herramienta", "equipo", "epp"];

const FITOSANITARIO_TOKENS = [
  "fitosanitario",
  "fitosanidad",
  "agroquímico",
  "agroquimico",
  "plaguicida",
  "herbicida",
  "fungicida",
  "insecticida",
  "acaricida",
  "rodenticida",
  "nematicida",
  "moluscicida",
  "biológico",
  "biologico",
  "mip",
];

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

/** Insumo de nutrición (RF22) — excluido de aplicación fitosanitaria. */
export function isInsumoNutricion(subcategoria: string | null | undefined): boolean {
  const s = norm(subcategoria);
  if (!s) return false;
  if (s === "nutricion") return true;
  return NUTRICION_TOKENS.some((t) => s.includes(t));
}

export function isInsumoHerramienta(subcategoria: string | null | undefined): boolean {
  const s = norm(subcategoria);
  if (!s) return false;
  if (s === "herramienta") return true;
  return HERRAMIENTA_TOKENS.some((t) => s.includes(t));
}

/**
 * Producto fitosanitario aplicable en orden / aplicación (categoria insumo + subcategoría).
 * Si subcategoría está vacía, no se considera fitosanitario (evita errores de datos).
 */
export function isInsumoFitosanitarioProducto(row: {
  categoria: string;
  subcategoria: string | null | undefined;
}): boolean {
  if (row.categoria !== "insumo") return false;
  const s = norm(row.subcategoria);
  if (!s) return false;
  if (isInsumoNutricion(s)) return false;
  if (isInsumoHerramienta(s)) return false;
  if (s === "fitosanitario") return true;
  return FITOSANITARIO_TOKENS.some((t) => s.includes(t));
}

/** Texto para UI / documentación interna. */
export const SUBCATEGORIA_INSUMO_GUIA =
  "Seleccione Nutrición, Fitosanitario o Herramienta. Detalle el producto (herbicida, urea…) en descripción si aplica.";
