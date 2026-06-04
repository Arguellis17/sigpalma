/** Parsea entrada decimal del usuario (acepta coma o punto). */
export function parseDecimalInput(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "" || s === "." || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const PARTIAL_DECIMAL = /^-?\d*(?:[.,]\d*)?$/;
const PARTIAL_INTEGER = /^-?\d*$/;

/** Filtra teclas para estado controlado; devuelve null si la cadena no es válida parcial. */
export function sanitizeNumericInput(
  next: string,
  options?: { integer?: boolean }
): string | null {
  if (next === "") return "";
  const pattern = options?.integer ? PARTIAL_INTEGER : PARTIAL_DECIMAL;
  return pattern.test(next) ? next : null;
}

/** Normaliza al perder foco: quita punto/coma final suelta. */
export function normalizeNumericInputOnBlur(value: string): string {
  const t = value.trim();
  if (t.endsWith(".") || t.endsWith(",")) {
    return t.slice(0, -1);
  }
  return t;
}
