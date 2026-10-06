import { z } from "zod";

const uuid = z.string().uuid();

export const reporteProductividadSchema = z
  .object({
    finca_id: uuid,
    fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lote_ids: z.array(uuid).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fecha_hasta < data.fecha_desde) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha fin no puede ser anterior a la fecha inicio.",
        path: ["fecha_hasta"],
      });
    }
  });

export type ReporteProductividadInput = z.infer<typeof reporteProductividadSchema>;

/** Query string de los endpoints de exportación: ?finca_id&fecha_desde&fecha_hasta&lote_ids=a,b */
export function parseReporteProductividadQuery(url: URL) {
  const loteIdsRaw = url.searchParams.get("lote_ids");
  return reporteProductividadSchema.safeParse({
    finca_id: url.searchParams.get("finca_id"),
    fecha_desde: url.searchParams.get("fecha_desde"),
    fecha_hasta: url.searchParams.get("fecha_hasta"),
    lote_ids: loteIdsRaw
      ? loteIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
  });
}
