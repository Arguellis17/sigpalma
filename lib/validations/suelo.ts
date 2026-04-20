import { z } from "zod";

export const registrarAnalisisSueloSchema = z
  .object({
    finca_id: z.string().uuid("Seleccione una finca válida."),
    lote_id: z.string().uuid("Seleccione un lote válido."),
    fecha_analisis: z.string().min(1, "Indique la fecha del análisis."),
    ph: z
      .number()
      .min(0, "El pH no puede ser negativo.")
      .max(14, "El pH máximo es 14.")
      .nullable()
      .optional(),
    humedad_pct: z
      .number()
      .min(0, "La humedad no puede ser negativa.")
      .max(100, "La humedad máxima es 100%.")
      .nullable()
      .optional(),
    compactacion: z
      .number()
      .min(0, "La compactación no puede ser negativa.")
      .nullable()
      .optional(),
    nutrientes: z
      .record(z.string(), z.number())
      .nullable()
      .optional(),
    notas: z.string().max(2000).nullable().optional(),
    // archivo_url is set by the upload flow, not from form input directly
    archivo_url: z.string().url("URL de archivo inválida.").nullable().optional(),
  })
  .refine(
    (d) =>
      d.ph !== undefined ||
      d.humedad_pct !== undefined ||
      d.compactacion !== undefined ||
      (d.nutrientes && Object.keys(d.nutrientes).length > 0),
    {
      message: "Registre al menos un valor de análisis (pH, humedad, compactación o nutrientes).",
    }
  );

export type RegistrarAnalisisSueloInput = z.infer<
  typeof registrarAnalisisSueloSchema
>;

export const actualizarAnalisisSueloSchema = registrarAnalisisSueloSchema.extend({
  id: z.string().uuid("Identificador de análisis inválido."),
});

export type ActualizarAnalisisSueloInput = z.infer<
  typeof actualizarAnalisisSueloSchema
>;

export const anularAnalisisSueloSchema = z.object({
  id: z.string().uuid("Identificador de análisis inválido."),
});
