import { z } from "zod";

function hasNonEmptyNutrientes(
  n: Record<string, number> | null | undefined
): boolean {
  return Boolean(n && Object.keys(n).length > 0);
}

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

function hasAtLeastOneAnalisisValor(d: {
  ph?: number | null;
  humedad_pct?: number | null;
  compactacion?: number | null;
  nutrientes?: Record<string, number> | null;
  fertilidad_completa?: string | null;
  textura?: string | null;
  aluminio?: number | null;
  cic?: number | null;
  materia_organica_pct?: number | null;
  drenaje_campo?: string | null;
}): boolean {
  if (d.ph != null && Number.isFinite(d.ph)) return true;
  if (d.humedad_pct != null && Number.isFinite(d.humedad_pct)) return true;
  if (d.compactacion != null && Number.isFinite(d.compactacion)) return true;
  if (hasNonEmptyNutrientes(d.nutrientes ?? null)) return true;
  if (trimOrNull(d.fertilidad_completa ?? null)) return true;
  if (trimOrNull(d.textura ?? null)) return true;
  if (d.aluminio != null && Number.isFinite(d.aluminio)) return true;
  if (d.cic != null && Number.isFinite(d.cic)) return true;
  if (d.materia_organica_pct != null && Number.isFinite(d.materia_organica_pct)) {
    return true;
  }
  if (trimOrNull(d.drenaje_campo ?? null)) return true;
  return false;
}

function optionalTrimmedText(max: number, label: string) {
  return z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z
      .union([
        z.null(),
        z.string().max(max, `${label}: máximo ${max} caracteres.`),
      ])
      .transform((v) => (v == null ? null : trimOrNull(v)))
  ).optional();
}

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
    fertilidad_completa: optionalTrimmedText(4000, "Fertilidad completa"),
    textura: optionalTrimmedText(500, "Textura"),
    aluminio: z
      .number()
      .min(0, "El aluminio no puede ser negativo.")
      .max(1_000_000, "Valor de aluminio fuera de rango.")
      .nullable()
      .optional(),
    cic: z
      .number()
      .min(0, "La CIC no puede ser negativa.")
      .max(1_000_000, "Valor de CIC fuera de rango.")
      .nullable()
      .optional(),
    materia_organica_pct: z
      .number()
      .min(0, "La materia orgánica no puede ser negativa.")
      .max(100, "La materia orgánica no puede superar 100%.")
      .nullable()
      .optional(),
    drenaje_campo: optionalTrimmedText(2000, "Drenaje en campo"),
    nutrientes: z
      .record(z.string(), z.number())
      .nullable()
      .optional(),
    notas: z.string().max(2000).nullable().optional(),
    // archivo_url is set by the upload flow, not from form input directly
    archivo_url: z.string().url("URL de archivo inválida.").nullable().optional(),
  })
  .refine((d) => hasAtLeastOneAnalisisValor(d), {
    message:
      "Registre al menos un valor de análisis (pH, humedad, compactación, nutrientes o los campos adicionales).",
  });

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
