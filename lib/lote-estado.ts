/** HU10 RN26 — estados de cultivo del lote (enum en BD). */
export const LOTE_ESTADO_CULTIVO_VALUES = [
  "vacante",
  "disponible",
  "planificado_siembra",
  "listo_para_siembra",
  "en_produccion",
] as const;

export type LoteEstadoCultivo = (typeof LOTE_ESTADO_CULTIVO_VALUES)[number];

export const LOTE_ESTADO_CULTIVO_LABEL: Record<LoteEstadoCultivo, string> = {
  vacante: "Vacante",
  disponible: "Disponible",
  planificado_siembra: "Planificado para siembra",
  listo_para_siembra: "Listo para siembra",
  en_produccion: "En producción",
};

export const LOTE_ESTADOS_PLANIFICABLES: LoteEstadoCultivo[] = ["vacante", "disponible"];

export function isEstadoPlanificable(estado: string): boolean {
  return (LOTE_ESTADOS_PLANIFICABLES as readonly string[]).includes(estado);
}

export function labelEstadoCultivo(estado: string): string {
  return LOTE_ESTADO_CULTIVO_LABEL[estado as LoteEstadoCultivo] ?? estado;
}
