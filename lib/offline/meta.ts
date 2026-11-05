import { z } from "zod";
import type { RespuestaSync } from "./tipos";

/**
 * Metadatos de una operación capturada en el dispositivo (modo offline-first).
 * - client_op_id: id único de la operación; con el índice único parcial de cada tabla garantiza
 *   que un reintento de sincronización nunca cree un segundo registro.
 * - capturado_en: hora real del registro en el dispositivo (puede ser horas antes de created_at).
 */
const metaOfflineSchema = z.object({
  client_op_id: z.uuid().optional(),
  capturado_en: z.iso.datetime({ offset: true }).optional(),
});

export type MetaOffline = { client_op_id: string | null; capturado_en: string | null };

/** Lee los metadatos offline del payload crudo de una acción (los esquemas Zod de dominio los descartan). */
export function metaOffline(raw: unknown): MetaOffline {
  const src =
    raw instanceof FormData
      ? {
          client_op_id: raw.get("client_op_id") ?? undefined,
          capturado_en: raw.get("capturado_en") ?? undefined,
        }
      : raw;
  const r = metaOfflineSchema.safeParse(src ?? {});
  if (!r.success) return { client_op_id: null, capturado_en: null };
  return { client_op_id: r.data.client_op_id ?? null, capturado_en: r.data.capturado_en ?? null };
}

/** Prefijo de los errores por conflicto de estado (otro usuario llegó primero); la cola no los reintenta. */
export const PREFIJO_CONFLICTO = "CONFLICTO: ";

export function esConflicto(mensaje: string): boolean {
  return mensaje.startsWith(PREFIJO_CONFLICTO);
}

/** Quita el prefijo técnico para mostrar el mensaje al usuario. */
export function textoError(mensaje: string): string {
  return esConflicto(mensaje) ? mensaje.slice(PREFIJO_CONFLICTO.length) : mensaje;
}

/** La operación ya se aplicó en un intento anterior (índice único `<tabla>_client_op_id_uq`). */
export function esOperacionRepetida(mensaje: string): boolean {
  return mensaje.includes("client_op_id_uq");
}

// ponytail: heurística por texto del error de Supabase; si aparece otro mensaje transitorio, añadirlo aquí.
const ERROR_TRANSITORIO = /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timed? ?out|socket|upstream|50[234]/i;

/** Clasifica el mensaje de error de una acción para decidir si la cola reintenta o no. */
export function clasificarErrorAccion(mensaje: string): Exclude<RespuestaSync, { estado: "ok" }> {
  if (esConflicto(mensaje)) return { estado: "conflicto", motivo: textoError(mensaje) };
  if (/^Sesi[oó]n no/i.test(mensaje)) return { estado: "sesion", motivo: mensaje };
  if (ERROR_TRANSITORIO.test(mensaje)) return { estado: "reintentar", motivo: mensaje };
  return { estado: "rechazado", motivo: mensaje };
}
