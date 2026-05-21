export const estadosInventarioHerramienta = [
  "disponible",
  "en_uso",
  "danada",
  "perdida",
] as const;

export type EstadoInventarioHerramienta = (typeof estadosInventarioHerramienta)[number];

export const ESTADO_HERRAMIENTA_LABELS: Record<EstadoInventarioHerramienta, string> = {
  disponible: "Disponible",
  en_uso: "En uso",
  danada: "Dañada",
  perdida: "Perdida",
};

export function labelEstadoHerramienta(value: string | null | undefined): string {
  if (!value) return "—";
  if (value in ESTADO_HERRAMIENTA_LABELS) {
    return ESTADO_HERRAMIENTA_LABELS[value as EstadoInventarioHerramienta];
  }
  return value;
}

export function estadoPermiteAsignacion(estado: string): boolean {
  return estado === "disponible";
}

export function estadoRequiereNotasDano(estado: string): boolean {
  return estado === "danada" || estado === "perdida";
}
