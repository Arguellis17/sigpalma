/** RN53 HU19: pendiente máxima permitida sin validación técnica adicional. */
export const PENDIENTE_TERRENO_MAX_PCT = 12;

export const ACTIVIDADES_PREPARACION_TERRENO = [
  "descapote",
  "nivelacion",
  "trazado",
  "desbroce",
  "surcos",
] as const;

export type ActividadPreparacionTerreno =
  (typeof ACTIVIDADES_PREPARACION_TERRENO)[number];

export const ACTIVIDAD_PREPARACION_LABEL: Record<
  ActividadPreparacionTerreno,
  string
> = {
  descapote: "Descapote",
  nivelacion: "Nivelación",
  trazado: "Trazado",
  desbroce: "Desbroce",
  surcos: "Apertura de surcos",
};

export function labelActividadPreparacion(id: string): string {
  return (
    ACTIVIDAD_PREPARACION_LABEL[id as ActividadPreparacionTerreno] ?? id
  );
}

export function pendienteRequiereValidacionTecnico(
  pendientePct: number
): boolean {
  return pendientePct >= PENDIENTE_TERRENO_MAX_PCT;
}

export function mensajePendienteCritica(pendientePct: number): string {
  return `Pendiente ${pendientePct}% igual o superior al ${PENDIENTE_TERRENO_MAX_PCT}%. El registro quedará pendiente de validación del técnico agrónomo (RN53).`;
}
