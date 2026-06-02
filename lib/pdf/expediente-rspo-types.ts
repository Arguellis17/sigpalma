import type { ExpedienteRspoAdvertencia } from "@/lib/trazabilidad/expediente-rspo";
import type { TrazabilidadTecnicaLotePayload } from "@/lib/trazabilidad/types";

export type ExpedienteRspoPdfData = {
  finca_nombre: string;
  lote_codigo: string;
  area_ha: number;
  material_genetico: string | null;
  anio_siembra: number;
  estado_cultivo: string;
  fecha_generacion: string;
  advertencias: ExpedienteRspoAdvertencia[];
  trazabilidad: TrazabilidadTecnicaLotePayload;
};
