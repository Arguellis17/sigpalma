import { z } from "zod";

const uuid = z.string().uuid();

export const validacionDecisionSchema = z.enum([
  "validado",
  "rechazado",
  "invalidado",
]);

export const ordenControlPayloadSchema = z.object({
  insumo_catalogo_id: uuid,
  dosis_recomendada: z.string().min(1).max(500),
  observaciones_tecnico: z.string().max(2000).optional().nullable(),
});

export const validarAlertaFitosanitariaSchema = z
  .object({
    alerta_id: uuid,
    decision: validacionDecisionSchema,
    validacion_diagnostico: z.string().min(1).max(4000),
    orden: ordenControlPayloadSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orden && data.decision !== "validado") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Solo puede emitir orden de control cuando la decisión es «validado».",
        path: ["orden"],
      });
    }
  });

export type ValidarAlertaFitosanitariaInput = z.infer<
  typeof validarAlertaFitosanitariaSchema
>;

export const registrarAplicacionFitosanitariaSchema = z
  .object({
    orden_id: uuid,
    fecha_aplicacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cantidad_aplicada: z.coerce.number().positive(),
    unidad_medida: z.string().max(50).optional().nullable(),
    epp_confirmado: z.boolean(),
    notas: z.string().max(5000).optional().nullable(),
    latitud: z.coerce.number().optional().nullable(),
    longitud: z.coerce.number().optional().nullable(),
    source: z.enum(["web", "mobile", "api"]).optional().default("web"),
  })
  .refine((d) => d.epp_confirmado === true, {
    message: "Debe confirmar uso de EPP para registrar la aplicación.",
    path: ["epp_confirmado"],
  });

export type RegistrarAplicacionFitosanitariaInput = z.infer<
  typeof registrarAplicacionFitosanitariaSchema
>;

export const cancelarOrdenControlSchema = z.object({
  orden_id: uuid,
  motivo: z.string().min(1).max(2000).optional(),
});
