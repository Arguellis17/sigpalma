import { z } from "zod";

const uuid = z.string().uuid();

export const registroSourceSchema = z.enum(["web", "mobile", "api"]);

export const registrarLaborSchema = z.object({
  finca_id: uuid,
  lote_id: uuid,
  tipo: z.string().min(1).max(200),
  fecha_ejecucion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().max(5000).optional().nullable(),
  source: registroSourceSchema.optional().default("web"),
  /** Si viene informado (HU11), debe coincidir con un ítem labor activo para agrónomos. */
  catalogo_item_id: uuid.optional().nullable(),
});

export const actualizarLaborSchema = z.object({
  id: uuid,
  lote_id: uuid,
  tipo: z.string().min(1).max(200),
  fecha_ejecucion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().max(5000).optional().nullable(),
  catalogo_item_id: uuid.optional().nullable(),
});

export const reportarCosechaSchema = z.object({
  finca_id: uuid,
  lote_id: uuid,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  peso_kg: z.coerce.number().positive(),
  conteo_racimos: z.coerce.number().int().positive(),
  madurez_frutos_caidos_min: z.coerce.number().int().min(0).max(20).optional().nullable(),
  madurez_frutos_caidos_max: z.coerce.number().int().min(0).max(20).optional().nullable(),
  observaciones_calidad: z.string().max(5000).optional().nullable(),
  source: registroSourceSchema.optional().default("web"),
});

export const nivelSeveridadSchema = z.enum([
  "baja",
  "media",
  "alta",
  "critica",
]);

export const alertaFitosanitariaSchema = z.object({
  finca_id: uuid,
  lote_id: uuid,
  catalogo_item_id: uuid.optional().nullable(),
  severidad: nivelSeveridadSchema,
  descripcion: z.string().max(5000).optional().nullable(),
  source: registroSourceSchema.optional().default("web"),
});

export const anularRegistroCampoSchema = z.object({
  id: uuid,
});

export type RegistrarLaborInput = z.infer<typeof registrarLaborSchema>;
export type ActualizarLaborInput = z.infer<typeof actualizarLaborSchema>;
export type ReportarCosechaInput = z.infer<typeof reportarCosechaSchema>;
export type AlertaFitosanitariaInput = z.infer<typeof alertaFitosanitariaSchema>;
