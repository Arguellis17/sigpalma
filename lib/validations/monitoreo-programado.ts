import { z } from "zod";

const uuid = z.string().uuid();

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use AAAA-MM-DD).");

export const crearMonitoreoProgramadoSchema = z.object({
  finca_id: uuid,
  lote_id: uuid,
  fecha_inspeccion: ymd,
  assigned_to: uuid,
  notas: z.string().max(5000).optional().nullable(),
});

export const actualizarMonitoreoProgramadoSchema = z.object({
  id: uuid,
  finca_id: uuid,
  lote_id: uuid,
  fecha_inspeccion: ymd,
  assigned_to: uuid,
  notas: z.string().max(5000).optional().nullable(),
});

export const anularMonitoreoProgramadoSchema = z.object({
  id: uuid,
});

export const marcarMonitoreoCompletadoSchema = z.object({
  id: uuid,
});

export type CrearMonitoreoProgramadoInput = z.infer<typeof crearMonitoreoProgramadoSchema>;
export type ActualizarMonitoreoProgramadoInput = z.infer<typeof actualizarMonitoreoProgramadoSchema>;
