import { z } from "zod";

const uuid = z.string().uuid();

export const crearRemisionDespachoSchema = z
  .object({
    finca_id: uuid,
    cosecha_ids: z.array(uuid).min(1, "Seleccione al menos una cosecha."),
    placa_vehiculo: z.string().min(5).max(12),
    conductor_identificacion: z.string().min(4).max(32),
    conductor_nombre: z.string().max(120).optional().nullable(),
    capacidad_vehiculo_kg: z.coerce.number().positive().optional().nullable(),
    destino: z.string().max(200).optional().nullable(),
    latitud: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitud: z.coerce.number().min(-180).max(180).optional().nullable(),
    confirmar_sobrecarga: z.boolean().optional().default(false),
    source: z.enum(["web", "mobile", "api"]).optional().default("web"),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.latitud != null && Number.isFinite(data.latitud);
    const hasLng = data.longitud != null && Number.isFinite(data.longitud);
    if (!hasLat || !hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active la ubicación GPS antes de cerrar la remisión de salida.",
        path: ["latitud"],
      });
    }
  });

export type CrearRemisionDespachoInput = z.infer<typeof crearRemisionDespachoSchema>;
