import { z } from "zod";

const uuid = z.string().uuid();

export const registrarSiembraPlantulasSchema = z
  .object({
    finca_id: uuid,
    lote_id: uuid,
    plan_siembra_id: uuid,
    preparacion_terreno_id: uuid,
    fecha_siembra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cantidad_palmas: z.coerce.number().int().positive(),
    confirmacion_profundidad: z.boolean(),
    confirmacion_orientacion: z.boolean(),
    notas: z.string().max(5000).optional().nullable(),
    source: z.enum(["web", "mobile", "api"]).optional().default("web"),
  })
  .refine((d) => d.confirmacion_profundidad === true, {
    message: "Confirme el cumplimiento de la profundidad de siembra (RN56).",
    path: ["confirmacion_profundidad"],
  })
  .refine((d) => d.confirmacion_orientacion === true, {
    message:
      "Confirme la orientación correcta de plúmula y radícula (RN56).",
    path: ["confirmacion_orientacion"],
  });

export type RegistrarSiembraPlantulasInput = z.infer<
  typeof registrarSiembraPlantulasSchema
>;
