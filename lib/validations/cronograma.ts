import { z } from "zod";
import { FRECUENCIAS_CRONOGRAMA } from "@/lib/cronogramas";

const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use AAAA-MM-DD).");

const reglaCronograma = z.object({
  finca_id: uuid,
  lote_id: uuid,
  catalogo_item_id: uuid,
  assigned_to: uuid,
  frecuencia: z.enum(FRECUENCIAS_CRONOGRAMA),
  intervalo: z.coerce.number().int().min(1, "El intervalo mínimo es 1.").max(52, "El intervalo máximo es 52."),
  dias_semana: z.array(z.number().int().min(1).max(7)).default([]),
  fecha_inicio: ymd,
  fecha_fin: ymd.optional().nullable(),
  notas: z.string().max(5000).optional().nullable(),
});

type Regla = z.infer<typeof reglaCronograma>;

function validarRegla(d: Regla, ctx: z.RefinementCtx) {
  if (d.frecuencia === "semanal" && d.dias_semana.length === 0) {
    ctx.addIssue({ code: "custom", message: "Seleccione al menos un día de la semana.", path: ["dias_semana"] });
  }
  if (d.fecha_fin && d.fecha_fin < d.fecha_inicio) {
    ctx.addIssue({ code: "custom", message: "La fecha final no puede ser anterior a la inicial.", path: ["fecha_fin"] });
  }
}

export const crearCronogramaSchema = reglaCronograma.superRefine(validarRegla);
export const actualizarCronogramaSchema = reglaCronograma.extend({ id: uuid }).superRefine(validarRegla);
export const cambiarEstadoCronogramaSchema = z.object({ id: uuid, activo: z.boolean() });
export const anularCronogramaSchema = z.object({ id: uuid });

export type CrearCronogramaInput = z.infer<typeof crearCronogramaSchema>;
