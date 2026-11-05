import { z } from "zod";
import { UNIDADES_PAGO, UNIDADES_PAGO_COSECHA } from "@/lib/jornales";

const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use AAAA-MM-DD).");

/** Tarifa por labor (palma, hectárea o jornal), o de cosecha sin labor (kilo o racimo). */
export const guardarTarifaSchema = z
  .object({
    catalogo_item_id: uuid.nullable().optional(),
    unidad_medida: z.enum(UNIDADES_PAGO),
    valor_unitario: z.coerce
      .number()
      .positive("El valor debe ser mayor que cero.")
      .max(999_999_999, "Valor fuera de rango."),
    vigente_desde: ymd,
  })
  .refine(
    (d) => (UNIDADES_PAGO_COSECHA as readonly string[]).includes(d.unidad_medida) === !d.catalogo_item_id,
    { message: "Kilo y racimo son para la cosecha; palma, hectárea y jornal requieren una labor.", path: ["unidad_medida"] }
  );

export const anularTarifaSchema = z.object({ id: uuid });

export const periodoLiquidacionSchema = z
  .object({ desde: ymd, hasta: ymd })
  .refine((d) => d.hasta >= d.desde, { message: "La fecha final no puede ser anterior a la inicial." });

export const anularLiquidacionSchema = z.object({
  id: uuid,
  motivo: z.string().trim().min(10, "Indique el motivo de la anulación (mínimo 10 caracteres).").max(2000),
});
