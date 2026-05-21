import { z } from "zod";
import {
  calcularDesviacionPct,
  requiereJustificacionDesviacion,
} from "@/lib/fertilizacion-dosis";

const uuid = z.string().uuid();

export const metodoAplicacionFertilizacionSchema = z.enum([
  "manual",
  "equipada",
  "fertirriego",
  "otro",
]);

export const registrarAplicacionFertilizacionSchema = z
  .object({
    finca_id: uuid,
    plan_item_id: uuid,
    fecha_aplicacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cantidad_aplicada: z.coerce.number().positive(),
    metodo_aplicacion: metodoAplicacionFertilizacionSchema,
    justificacion_desviacion: z.string().max(4000).optional().nullable(),
    notas: z.string().max(5000).optional().nullable(),
    latitud: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitud: z.coerce.number().min(-180).max(180).optional().nullable(),
    source: z.enum(["web", "mobile", "api"]).optional().default("web"),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.latitud != null && Number.isFinite(data.latitud);
    const hasLng = data.longitud != null && Number.isFinite(data.longitud);
    if (!hasLat || !hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Active la ubicación GPS del dispositivo antes de registrar la aplicación en campo.",
        path: ["latitud"],
      });
    }
  });

export type RegistrarAplicacionFertilizacionInput = z.infer<
  typeof registrarAplicacionFertilizacionSchema
>;

/** Valida justificación cuando la desviación supera el umbral (RN63). */
export function validarJustificacionDesviacionFertilizacion(
  cantidadAplicada: number,
  dosisProgramada: number,
  justificacion: string | null | undefined
): string | null {
  if (!requiereJustificacionDesviacion(cantidadAplicada, dosisProgramada)) {
    return null;
  }
  const txt = justificacion?.trim() ?? "";
  if (txt.length < 10) {
    return "La desviación supera el 10% respecto al plan. Indique una justificación técnica obligatoria (RN63).";
  }
  return null;
}

export { calcularDesviacionPct };
