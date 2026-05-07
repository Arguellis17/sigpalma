/** HU17 — categorías alineadas con RN02 (≥5 fuentes integradas). */
export type TimelineEventCategory =
  | "material_plan"
  | "labor"
  | "nutricion"
  | "sanidad"
  | "cosecha";

export type TimelineEvent = {
  /** Identificador estable para keys de React (prefijo + id de fila). */
  id: string;
  category: TimelineEventCategory;
  /** ISO 8601 para orden cronológico descendente (RN01). */
  sortAt: string;
  /** Fecha de negocio principal (yyyy-MM-dd) para mostrar. */
  displayDate: string;
  title: string;
  subtitle?: string | null;
  metadata: Record<string, unknown>;
};

export type TrazabilidadLoteCabecera = {
  id: string;
  codigo: string;
  finca_id: string;
  area_ha: number;
  activo: boolean;
  estado_cultivo: string;
  material_genetico: string | null;
  anio_siembra: number;
};

export type TrazabilidadResumen = {
  materialDeclarado: string | null;
  estadoCultivo: string;
  ultimaCosecha: {
    fecha: string;
    rendimientoTonHa: number;
    pesoKg: number;
    conteoRacimos: number;
  } | null;
  /** Promedio simple de rendimiento (t/ha) en registros recientes de la finca (misma consulta). */
  rendimientoPromedioFinca: number | null;
  cosechasEnLote: number;
  tendenciaTexto: string | null;
  ultimaAlertaFuerte: {
    sortAt: string;
    severidad: string;
    title: string;
  } | null;
  conteoPorCategoria: Record<TimelineEventCategory, number>;
};

export type TrazabilidadTecnicaLotePayload = {
  lote: TrazabilidadLoteCabecera;
  eventos: TimelineEvent[];
  resumen: TrazabilidadResumen;
};
