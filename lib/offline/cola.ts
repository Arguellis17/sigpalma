/**
 * Cola de operaciones capturadas en el dispositivo (outbox) en IndexedDB + sincronización con
 * POST /api/v1/sync. Solo navegador.
 *
 * - Cada registro de campo se guarda primero aquí (nunca se pierde si se cae la señal a mitad de envío).
 * - Se envía uno a la vez, en orden de captura, solo las operaciones del usuario en sesión.
 * - `navigator.locks` evita que dos pestañas envíen a la vez; el servidor es idempotente por `opId`
 *   de todas formas.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { TIPOS_CON_FOTOS, type RespuestaSync, type TipoOperacion } from "./tipos";
import {
  aplicarRespuesta,
  debeLimpiarse,
  porEnviar,
  respuestaSinCuerpo,
  type ArchivoOperacion,
  type Operacion,
} from "./reglas";

interface EsquemaOffline extends DBSchema {
  operaciones: { key: string; value: Operacion; indexes: { por_usuario: string } };
  /** Caché de lecturas para formularios sin conexión (lib/offline/referencia.ts). */
  referencia: { key: string; value: { valor: unknown; guardadoEn: number } };
}

const NOMBRE_DB = "sigpalma-offline";
export const EVENTO_COLA = "sigpalma-cola";
// Solo en el navegador: Node también tiene BroadcastChannel y mantendría vivo el proceso de SSR.
const canal =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(EVENTO_COLA) : null;

let dbPromesa: Promise<IDBPDatabase<EsquemaOffline>> | null = null;

export function abrirDb() {
  dbPromesa ??= openDB<EsquemaOffline>(NOMBRE_DB, 1, {
    upgrade(db) {
      const ops = db.createObjectStore("operaciones", { keyPath: "opId" });
      ops.createIndex("por_usuario", "userId");
      db.createObjectStore("referencia");
    },
  });
  return dbPromesa;
}

/** Avisa a esta pestaña y a las demás que la cola cambió. */
function notificarCambio() {
  window.dispatchEvent(new Event(EVENTO_COLA));
  canal?.postMessage("cambio");
}
canal?.addEventListener("message", () => window.dispatchEvent(new Event(EVENTO_COLA)));

export async function listarOperaciones(userId: string): Promise<Operacion[]> {
  const db = await abrirDb();
  const ops = await db.getAllFromIndex("operaciones", "por_usuario", userId);
  return ops.sort((a, b) => a.creadoEn - b.creadoEn);
}

export async function encolar(params: {
  userId: string;
  tipo: TipoOperacion;
  payload: Record<string, unknown>;
  archivos?: ArchivoOperacion[];
  resumen?: string;
}): Promise<Operacion> {
  const op: Operacion = {
    opId: crypto.randomUUID(),
    userId: params.userId,
    tipo: params.tipo,
    resumen: params.resumen ?? "",
    payload: params.payload,
    archivos: params.archivos ?? [],
    capturadoEn: new Date().toISOString(),
    creadoEn: Date.now(),
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    ultimoError: null,
    sincronizadoEn: null,
  };
  const db = await abrirDb();
  await db.put("operaciones", op);
  notificarCambio();
  pedirSyncEnSegundoPlano();
  return op;
}

export async function descartarOperacion(opId: string) {
  const db = await abrirDb();
  await db.delete("operaciones", opId);
  notificarCambio();
}

/** Vuelve a poner en cola una operación rechazada / en conflicto (p. ej. tras corregir en el servidor). */
export async function reintentarOperacion(opId: string) {
  const db = await abrirDb();
  const op = await db.get("operaciones", opId);
  if (!op) return;
  await db.put("operaciones", { ...op, estado: "pendiente", proximoIntento: 0 });
  notificarCambio();
}

/** Corrige los datos de una operación rechazada y la vuelve a enviar; conserva fotos y hora de captura. */
export async function corregirOperacion(opId: string, payload: Record<string, unknown>) {
  const db = await abrirDb();
  const op = await db.get("operaciones", opId);
  if (!op) return;
  await db.put("operaciones", { ...op, payload, estado: "pendiente", proximoIntento: 0, ultimoError: null });
  notificarCambio();
}

/** Borra todo lo del usuario (al cerrar sesión, tras confirmar). */
export async function borrarDatosUsuario(userId: string) {
  const db = await abrirDb();
  const tx = db.transaction(["operaciones", "referencia"], "readwrite");
  for (const k of await tx.objectStore("operaciones").index("por_usuario").getAllKeys(userId)) {
    await tx.objectStore("operaciones").delete(k);
  }
  await tx.objectStore("referencia").clear();
  await tx.done;
  notificarCambio();
}

/**
 * Al cerrar sesión: borra las páginas y lecturas guardadas (datos de la finca en un equipo que puede
 * ser compartido). Los registros sin enviar se conservan salvo `borrarCola`; solo se sincronizan
 * cuando vuelve a entrar el mismo usuario.
 */
export async function limpiarAlCerrarSesion(userId: string, borrarCola: boolean) {
  try {
    if (borrarCola) {
      await borrarDatosUsuario(userId);
    } else {
      const db = await abrirDb();
      await db.clear("referencia");
    }
    if (typeof caches !== "undefined") {
      // El precaché (código de la app y página sin conexión) no contiene datos: se conserva.
      for (const nombre of await caches.keys()) if (!nombre.includes("precache")) await caches.delete(nombre);
    }
    // La próxima sesión vuelve a precargar sus páginas (components/offline/estado-offline.tsx).
    localStorage.removeItem(`sigpalma-precarga:${userId}`);
  } catch {
    /* limpieza de mejor esfuerzo */
  }
}

/** POST al endpoint de sincronización. null = sin red / respuesta ilegible (se reintenta). */
async function postSync(op: Operacion, archivos: ArchivoOperacion[], fase?: "archivo"): Promise<RespuestaSync | null> {
  const body = new FormData();
  body.append("op", JSON.stringify({ opId: op.opId, tipo: op.tipo, payload: op.payload, capturadoEn: op.capturadoEn }));
  if (fase) body.append("fase", fase);
  for (const a of archivos) body.append("archivos", new File([a.blob], a.nombre, { type: a.tipo }));
  try {
    const res = await fetch("/api/v1/sync", { method: "POST", body, credentials: "same-origin", cache: "no-store" });
    const json = (await res.json().catch(() => null)) as RespuestaSync | null;
    if (json && typeof json === "object" && "estado" in json) return json;
    return respuestaSinCuerpo(res.status);
  } catch {
    return null;
  }
}

/** Sube las fotos pendientes de una en una, guardando el avance. Devuelve la falla, o null si terminó. */
async function subirFotos(op: Operacion): Promise<{ op: Operacion; falla: RespuestaSync | null | undefined }> {
  const db = await abrirDb();
  let actual = op;
  while (actual.archivos.length > 0) {
    const r = await postSync(actual, [actual.archivos[0]], "archivo");
    if (r?.estado !== "ok") return { op: actual, falla: r };
    const ruta = (r.data as { ruta?: string } | null)?.ruta;
    const rutas = Array.isArray(actual.payload.evidencia_urls) ? (actual.payload.evidencia_urls as string[]) : [];
    actual = {
      ...actual,
      archivos: actual.archivos.slice(1),
      payload: { ...actual.payload, evidencia_urls: ruta ? [...rutas, ruta] : rutas },
    };
    // Descartada mientras subía: no seguir ni crear el registro.
    if (!(await db.get("operaciones", op.opId))) return { op: actual, falla: null };
    await db.put("operaciones", actual);
  }
  return { op: actual, falla: undefined };
}

/** Envía la operación completa: fotos primero y luego el registro. */
async function enviar(op: Operacion): Promise<{ op: Operacion; r: RespuestaSync | null }> {
  if (!TIPOS_CON_FOTOS.includes(op.tipo)) return { op, r: await postSync(op, op.archivos) };
  const { op: actual, falla } = await subirFotos(op);
  if (falla !== undefined) return { op: actual, r: falla };
  return { op: actual, r: await postSync(actual, []) };
}

/** Ejecuta `fn` con un candado entre pestañas; si ya lo tiene otra pestaña, no hace nada. */
async function conCandado<T>(nombre: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (typeof navigator === "undefined" || !navigator.locks) return fn();
  return navigator.locks.request(nombre, { ifAvailable: true }, async (lock) => (lock ? fn() : undefined));
}

/** Envía una operación y guarda el resultado. Devuelve la respuesta (undefined si otra pestaña la está enviando). */
export async function sincronizarOperacion(opId: string): Promise<RespuestaSync | null | undefined> {
  return conCandado(`sigpalma-op-${opId}`, async () => {
    const db = await abrirDb();
    const op = await db.get("operaciones", opId);
    if (!op) return undefined;
    if (op.estado === "sincronizado") return { estado: "ok" as const, data: null };
    const { op: enviada, r } = await enviar(op);
    // La operación pudo descartarse mientras se enviaba: no resucitarla.
    if (await db.get("operaciones", opId)) await db.put("operaciones", aplicarRespuesta(enviada, r, Date.now()));
    notificarCambio();
    return r;
  });
}

/** Sincroniza en orden todo lo pendiente del usuario. Se detiene ante la primera falla de red o de sesión. */
export async function sincronizarPendientes(userId: string): Promise<void> {
  await conCandado("sigpalma-sincronizar", async () => {
    const db = await abrirDb();
    const ahora = Date.now();
    const todas = await listarOperaciones(userId);
    for (const op of todas) if (debeLimpiarse(op, ahora)) await db.delete("operaciones", op.opId);
    for (const op of porEnviar(todas, userId, ahora)) {
      const r = await sincronizarOperacion(op.opId);
      if (r === null || r?.estado === "reintentar" || r?.estado === "sesion") break;
    }
  });
}

/** Background Sync (Chromium): el service worker avisa al volver la señal aunque la pestaña esté en segundo plano. */
function pedirSyncEnSegundoPlano() {
  navigator.serviceWorker?.ready
    .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register("sigpalma-sincronizar"))
    .catch(() => undefined);
}

/** Conectividad real: navigator.onLine puede decir "en línea" con una red sin salida a internet. */
export async function hayConexion(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch("/api/v1/ping", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
