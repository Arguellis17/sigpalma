import { z } from "zod";

const uuid = z.string().uuid();

export const planNutricionFrecuenciaSchema = z.enum([
  "once",
  "semanal",
  "quincenal",
  "mensual",
  "personalizado",
]);

export const planNutricionItemInputSchema = z.object({
  catalogo_insumo_id: uuid,
  dosis_cantidad: z.coerce.number().positive(),
  dosis_unidad: z.enum(["por_ha", "por_palma"]),
  frecuencia: planNutricionFrecuenciaSchema.default("once"),
  fecha_objetivo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  notas: z.string().max(2000).optional().nullable(),
});

export const planRiegoItemInputSchema = z.object({
  descripcion: z.string().min(1).max(500),
  intervalo_dias: z.coerce.number().int().positive().optional().nullable(),
  proxima_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  volumen_o_tiempo: z.string().max(500).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
});

export const crearPlanNutricionSchema = z
  .object({
    finca_id: uuid,
    lote_id: uuid,
    nombre: z.string().max(200).optional().nullable(),
    fecha_inicio: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    fecha_fin: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notas: z.string().max(5000).optional().nullable(),
    items: z.array(planNutricionItemInputSchema).default([]),
    riego: z.array(planRiegoItemInputSchema).default([]),
  })
  .refine((d) => d.items.length > 0 || d.riego.length > 0, {
    message: "Agregue al menos una línea de fertilización o un evento de riego.",
  });

export const actualizarPlanNutricionSchema = crearPlanNutricionSchema.and(
  z.object({
    id: uuid,
  })
);

export const anularPlanNutricionSchema = z.object({
  id: uuid,
});

export type CrearPlanNutricionInput = z.infer<typeof crearPlanNutricionSchema>;
export type ActualizarPlanNutricionInput = z.infer<typeof actualizarPlanNutricionSchema>;
export type PlanNutricionItemInput = z.infer<typeof planNutricionItemInputSchema>;
export type PlanRiegoItemInput = z.infer<typeof planRiegoItemInputSchema>;
