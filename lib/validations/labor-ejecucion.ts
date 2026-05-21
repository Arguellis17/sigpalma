import { z } from "zod";
import { UNIDADES_MEDIDA_LABOR } from "@/lib/labor-ejecucion";
import { registroSourceSchema } from "@/lib/validations/operativo";

const uuid = z.string().uuid();

export const unidadMedidaLaborSchema = z.enum(UNIDADES_MEDIDA_LABOR);

/** HU21 / RF21 — registro de ejecución por operario (RN59–RN61). */
export const registrarLaborEjecutadaSchema = z.object({
  finca_id: uuid,
  lote_id: uuid,
  catalogo_item_id: uuid,
  cantidad_ejecutada: z.coerce.number().positive("Indique una cantidad mayor a cero."),
  unidad_medida: unidadMedidaLaborSchema,
  fecha_ejecucion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().max(5000).optional().nullable(),
  /** Si viene informado, completa la programación HU11 en lugar de insertar. */
  labor_programada_id: uuid.optional().nullable(),
  source: registroSourceSchema.optional().default("web"),
});

export type RegistrarLaborEjecutadaInput = z.infer<
  typeof registrarLaborEjecutadaSchema
>;
