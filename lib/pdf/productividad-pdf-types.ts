import type { ReporteProductividadPayload } from "@/app/actions/reportes-productividad";

export type ProductividadPdfData = ReporteProductividadPayload & {
  generado_en: string;
};
