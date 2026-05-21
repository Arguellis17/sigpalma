import { z } from "zod";
import { estadosInventarioHerramienta } from "@/lib/herramientas-estado";

const uuid = z.string().uuid();

export const crearInventarioHerramientaSchema = z.object({
  finca_id: uuid,
  catalogo_item_id: uuid,
  codigo: z
    .string()
    .min(1, "Indique el código o ID de la herramienta.")
    .max(50, "Máximo 50 caracteres."),
});

export type CrearInventarioHerramientaInput = z.infer<typeof crearInventarioHerramientaSchema>;

export const cambiarEstadoInventarioHerramientaSchema = z
  .object({
    id: uuid,
    estado: z.enum(estadosInventarioHerramienta),
    notas_dano: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.estado === "danada" || data.estado === "perdida") {
      const n = data.notas_dano?.trim() ?? "";
      if (n.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Describa los hechos del daño o pérdida (mínimo 10 caracteres, RN82).",
          path: ["notas_dano"],
        });
      }
    }
  });

export type CambiarEstadoInventarioHerramientaInput = z.infer<
  typeof cambiarEstadoInventarioHerramientaSchema
>;

export const tomarHerramientaSchema = z.object({
  id: uuid,
});

export const devolverHerramientaSchema = z.object({
  id: uuid,
});
