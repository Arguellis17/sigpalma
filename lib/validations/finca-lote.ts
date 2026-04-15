import { z } from "zod";

const currentYear = new Date().getFullYear();

export const crearFincaSchema = z.object({
  nombre: z.string().min(1).max(200),
  ubicacion: z.string().max(2000).optional().nullable(),
  area_ha: z.coerce.number().positive().max(1_000_000),
  propietario: z.string().max(300).optional().nullable(),
});

export const crearLoteSchema = z.object({
  finca_id: z.string().uuid(),
  codigo: z.string().min(1).max(80),
  area_ha: z.coerce.number().positive().max(1_000_000),
  anio_siembra: z.coerce
    .number()
    .int()
    .min(1900)
    .max(currentYear),
  material_genetico: z.string().max(200).optional().nullable(),
  densidad_palmas_ha: z.preprocess(
    (v) =>
      v === "" || v === null || v === undefined ? undefined : v,
    z.coerce.number().positive().max(500).optional()
  ),
});

export const actualizarFincaSchema = crearFincaSchema.extend({
  id: z.string().uuid(),
});

export const actualizarLoteSchema = crearLoteSchema.extend({
  id: z.string().uuid(),
});

export type CrearFincaInput = z.infer<typeof crearFincaSchema>;
export type CrearLoteInput = z.infer<typeof crearLoteSchema>;
export type ActualizarFincaInput = z.infer<typeof actualizarFincaSchema>;
export type ActualizarLoteInput = z.infer<typeof actualizarLoteSchema>;
