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
  evidencia_urls: z
    .array(z.string().min(3).max(500))
    .min(1, "Adjunte al menos una foto de evidencia.")
    .max(8),
  source: registroSourceSchema.optional().default("web"),
});

/** HU25 / RF25 RN71: plaga obligatoria del catálogo fitosanitario. */
export const reportePlagaSchema = alertaFitosanitariaSchema.extend({
  catalogo_item_id: uuid,
});

export type ReportePlagaInput = z.infer<typeof reportePlagaSchema>;

/** HU26 / RF26 RN74: enfermedad obligatoria del catálogo fitosanitario. */
export const reporteEnfermedadSchema = alertaFitosanitariaSchema.extend({
  catalogo_item_id: uuid,
});

export type ReporteEnfermedadInput = z.infer<typeof reporteEnfermedadSchema>;

export const anularRegistroCampoSchema = z.object({
  id: uuid,
});

export type RegistrarLaborInput = z.infer<typeof registrarLaborSchema>;
export type ActualizarLaborInput = z.infer<typeof actualizarLaborSchema>;
export type ReportarCosechaInput = z.infer<typeof reportarCosechaSchema>;
export type AlertaFitosanitariaInput = z.infer<typeof alertaFitosanitariaSchema>;
