import { z } from "zod";
import { registroSourceSchema } from "@/lib/validations/operativo";

const uuid = z.string().uuid();

export const registrarCensoSanitarioSchema = z
  .object({
    finca_id: uuid,
    lote_id: uuid,
    catalogo_item_id: uuid,
    fecha_censo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    palmas_inspeccionadas: z.coerce.number().int().positive(),
    palmas_afectadas: z.coerce.number().int().min(0),
    notas: z.string().max(2000).optional().nullable(),
    source: registroSourceSchema.optional().default("web"),
  })
  .superRefine((data, ctx) => {
    if (data.palmas_afectadas > data.palmas_inspeccionadas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las palmas afectadas no pueden superar las inspeccionadas.",
        path: ["palmas_afectadas"],
      });
    }
  });

export type RegistrarCensoSanitarioInput = z.infer<typeof registrarCensoSanitarioSchema>;
