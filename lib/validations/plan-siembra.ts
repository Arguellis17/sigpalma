import { z } from "zod";

const uuid = z.string().uuid();

export const loteEstadoCultivoSchema = z.enum([
  "vacante",
  "disponible",
  "planificado_siembra",
  "en_produccion",
]);

export const crearPlanSiembraSchema = z.object({
  finca_id: uuid,
  lote_id: uuid,
  catalogo_material_id: uuid,
  fecha_proyectada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmacion_erosion: z.boolean().optional().default(false),
  notas: z.string().max(5000).optional().nullable(),
});

export const actualizarPlanSiembraSchema = z.object({
  id: uuid,
  catalogo_material_id: uuid,
  fecha_proyectada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmacion_erosion: z.boolean().optional().default(false),
  notas: z.string().max(5000).optional().nullable(),
});

export const anularPlanSiembraSchema = z.object({
  id: uuid,
});

export type CrearPlanSiembraInput = z.infer<typeof crearPlanSiembraSchema>;
export type ActualizarPlanSiembraInput = z.infer<typeof actualizarPlanSiembraSchema>;
