import { z } from "zod";

const uuid = z.string().uuid();

export const crearEvaluacionViveroSchema = z
  .object({
    finca_id: uuid,
    germinacion_id: uuid,
    total_inicial: z.coerce.number().int().min(1),
    unidades_germinadas: z.coerce.number().int().min(0),
    unidades_descartadas: z.coerce.number().int().min(0),
    motivo_descarte: z.string().max(5000).optional().nullable(),
    observaciones_fitosanitarias: z.string().max(5000).optional().nullable(),
    concepto: z.enum(["apto_trasplante", "no_apto"]),
    evidencia_urls: z.array(z.string().min(3).max(500)).max(8).optional().default([]),
  })
  .refine((d) => d.unidades_germinadas + d.unidades_descartadas <= d.total_inicial, {
    message: "La suma de germinadas y descartadas no puede superar el total inicial.",
  })
  .refine(
    (d) => {
      if (d.unidades_descartadas > 0) {
        return Boolean(d.motivo_descarte && d.motivo_descarte.trim().length >= 3);
      }
      return true;
    },
    { message: "RN39: indique el motivo de descarte (mínimo 3 caracteres) si hay unidades descartadas." }
  );

export const anularEvaluacionViveroSchema = z.object({
  id: uuid,
});

export type CrearEvaluacionViveroInput = z.infer<typeof crearEvaluacionViveroSchema>;
