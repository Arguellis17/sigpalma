import { z } from "zod";
import { UNIDADES_MEDIDA_LABOR } from "@/lib/labor-ejecucion";

const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use AAAA-MM-DD).");

export const guardarTarifaSchema = z.object({
  catalogo_item_id: uuid,
  unidad_medida: z.enum(UNIDADES_MEDIDA_LABOR),
  valor_unitario: z.coerce
    .number()
    .positive("El valor debe ser mayor que cero.")
    .max(999_999_999, "Valor fuera de rango."),
  vigente_desde: ymd,
});

export const anularTarifaSchema = z.object({ id: uuid });

export const periodoLiquidacionSchema = z
  .object({ desde: ymd, hasta: ymd })
  .refine((d) => d.hasta >= d.desde, { message: "La fecha final no puede ser anterior a la inicial." });

export const anularLiquidacionSchema = z.object({
  id: uuid,
  motivo: z.string().trim().min(10, "Indique el motivo de la anulación (mínimo 10 caracteres).").max(2000),
});
