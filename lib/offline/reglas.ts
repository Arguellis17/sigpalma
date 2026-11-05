/**
 * Reglas puras de la cola offline (sin IndexedDB ni red) para poder probarlas con Vitest.
 */
import type { RespuestaSync, TipoOperacion } from "./tipos";

export type EstadoOperacion =
  /** Esperando envío (o reintento tras falla temporal). */
  | "pendiente"
  /** Falla temporal; se reintenta en `proximoIntento`. */
  | "error"
  /** Requiere volver a iniciar sesión; no se pierde. */
  | "sesion"
  /** Otro usuario llegó primero; el usuario revisa y descarta. */
  | "conflicto"
  /** El servidor rechazó los datos; el usuario revisa y descarta (o reintenta). */
  | "rechazado"
  /** Aplicada en el servidor; se borra pasado un tiempo. */
  | "sincronizado";

export type ArchivoOperacion = { nombre: string; tipo: string; blob: Blob };

export type Operacion = {
  opId: string;
  userId: string;
  tipo: TipoOperacion;
  /** Texto corto para el panel (lote, fecha…). */
  resumen: string;
  payload: Record<string, unknown>;
  archivos: ArchivoOperacion[];
  capturadoEn: string;
  creadoEn: number;
  estado: EstadoOperacion;
  intentos: number;
  proximoIntento: number;
  ultimoError: string | null;
  sincronizadoEn: number | null;
};

const ESPERA_BASE_MS = 2_000;
const ESPERA_MAX_MS = 5 * 60_000;
/** Las operaciones ya sincronizadas se muestran un día y luego se limpian. */
export const RETENCION_SINCRONIZADAS_MS = 24 * 60 * 60_000;

/** Espera exponencial con tope (2 s, 4 s, 8 s … 5 min) y ±20 % de variación para no sincronizar todos a la vez. */
export function esperaReintento(intentos: number, azar: number = Math.random()): number {
  const base = Math.min(ESPERA_BASE_MS * 2 ** Math.max(0, intentos - 1), ESPERA_MAX_MS);
  return Math.round(base * (0.8 + 0.4 * azar));
}

/** Estados que el sincronizador vuelve a enviar automáticamente. */
export function debeEnviarse(op: Operacion, ahora: number): boolean {
  if (op.estado === "pendiente" || op.estado === "sesion") return true;
  if (op.estado === "error") return op.proximoIntento <= ahora;
  return false;
}

/** Operaciones a enviar ahora, solo del usuario en sesión, en orden de captura (FIFO). */
export function porEnviar(ops: Operacion[], userId: string, ahora: number): Operacion[] {
  return ops
    .filter((o) => o.userId === userId && debeEnviarse(o, ahora))
    .sort((a, b) => a.creadoEn - b.creadoEn);
}

/** Cuántas operaciones del usuario siguen sin llegar al servidor (incluye conflictos por revisar). */
export function contarPendientes(ops: Operacion[], userId: string): number {
  return ops.filter((o) => o.userId === userId && o.estado !== "sincronizado").length;
}

/** Nuevo estado de la operación según la respuesta del servidor (null = falla de red). */
export function aplicarRespuesta(op: Operacion, r: RespuestaSync | null, ahora: number): Operacion {
  if (r?.estado === "ok") {
    return { ...op, estado: "sincronizado", sincronizadoEn: ahora, ultimoError: null, archivos: [] };
  }
  if (!r || r.estado === "reintentar") {
    const intentos = op.intentos + 1;
    return {
      ...op,
      estado: "error",
      intentos,
      proximoIntento: ahora + esperaReintento(intentos),
      ultimoError: r?.motivo ?? "Sin conexión con el servidor.",
    };
  }
  return { ...op, estado: r.estado, ultimoError: r.motivo };
}

/**
 * Respuesta HTTP sin el JSON del endpoint (la cortó un proxy o el proveedor). Un 413 / 4xx nunca va a
 * funcionar al reintentar; un 5xx o una respuesta rara sí puede (null = se reintenta como falla de red).
 */
export function respuestaSinCuerpo(status: number): RespuestaSync | null {
  if (status >= 500) return { estado: "reintentar", motivo: `Error del servidor (${status}).` };
  if (status === 413) return { estado: "rechazado", motivo: "El archivo es demasiado grande para enviarlo." };
  if (status >= 400) return { estado: "rechazado", motivo: `El servidor rechazó el envío (${status}).` };
  return null;
}

export function debeLimpiarse(op: Operacion, ahora: number): boolean {
  return op.estado === "sincronizado" && op.sincronizadoEn != null && ahora - op.sincronizadoEn > RETENCION_SINCRONIZADAS_MS;
}
