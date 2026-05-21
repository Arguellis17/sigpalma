import { z } from "zod";
import { ACTIVIDADES_PREPARACION_TERRENO } from "@/lib/preparacion-terreno";

const uuid = z.string().uuid();

export const actividadPreparacionSchema = z.enum(ACTIVIDADES_PREPARACION_TERRENO);

export const registrarPreparacionTerrenoSchema = z.object({
  finca_id: uuid,
  lote_id: uuid,
  plan_siembra_id: uuid,
  pendiente_final_pct: z.coerce
    .number()
    .min(0, "Indique una pendiente válida.")
    .max(100, "La pendiente no puede superar 100%."),
  actividades: z
    .array(actividadPreparacionSchema)
    .min(1, "Seleccione al menos una actividad realizada (RN54)."),
  notas: z.string().max(5000).optional().nullable(),
  source: z.enum(["web", "mobile", "api"]).optional().default("web"),
});

export type RegistrarPreparacionTerrenoInput = z.infer<
  typeof registrarPreparacionTerrenoSchema
>;

export const validarPreparacionTerrenoSchema = z.object({
  id: uuid,
  observacion_validacion: z.string().min(10).max(4000),
});

export type ValidarPreparacionTerrenoInput = z.infer<
  typeof validarPreparacionTerrenoSchema
>;
