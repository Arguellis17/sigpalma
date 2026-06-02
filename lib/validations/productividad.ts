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
