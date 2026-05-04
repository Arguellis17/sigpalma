import { z } from "zod";

const uuid = z.string().uuid();

export const crearRegistroGerminacionSchema = z
  .object({
    finca_id: uuid,
    catalogo_material_id: uuid,
    lote_id: uuid.optional().nullable(),
    fecha_tratamiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)."),
    temperatura_max_c: z.coerce.number().min(0).max(100),
    dias_tratamiento: z.coerce.number().int().min(1).max(365),
    notas: z.string().max(5000).optional().nullable(),
  })
  .refine(
    (d) => {
      if (d.temperatura_max_c > 42) {
        return Boolean(d.notas && d.notas.trim().length >= 5);
      }
      return true;
    },
    {
      message:
        "Temperatura máxima superior a 42 °C: registre un comentario de validación (RF18 escenario 2).",
    }
  );

export const actualizarRegistroGerminacionSchema = crearRegistroGerminacionSchema.and(
  z.object({ id: uuid })
);

export type CrearRegistroGerminacionInput = z.infer<typeof crearRegistroGerminacionSchema>;
export type ActualizarRegistroGerminacionInput = z.infer<typeof actualizarRegistroGerminacionSchema>;
