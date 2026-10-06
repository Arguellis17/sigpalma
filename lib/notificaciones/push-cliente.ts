/**
 * Web Push en el navegador: permiso → service worker → PushSubscription (clave VAPID) → servidor.
 * Solo para Client Components.
 */
import { eliminarSuscripcionPush, guardarSuscripcionPush } from "@/app/actions/push";

export function pushSoportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Clave pública VAPID (base64url) → bytes, como pide `pushManager.subscribe`. */
export function base64UrlABytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function mismaClave(actual: ArrayBuffer | null | undefined, esperada: Uint8Array): boolean {
  if (!actual) return false;
  const a = new Uint8Array(actual);
  return a.length === esperada.length && a.every((b, i) => b === esperada[i]);
}

/**
 * Con permiso concedido, asegura que este navegador tenga una suscripción vigente guardada para
 * el usuario en sesión (también reasigna el dispositivo si se cambió de cuenta).
 */
export async function sincronizarSuscripcionPush(): Promise<boolean> {
  const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pushSoportado() || Notification.permission !== "granted" || !clavePublica) return false;

  await navigator.serviceWorker.register("/sw.js");
  const registro = await navigator.serviceWorker.ready;
  const clave = base64UrlABytes(clavePublica);

  let suscripcion = await registro.pushManager.getSubscription();
  if (suscripcion && !mismaClave(suscripcion.options.applicationServerKey, clave)) {
    await suscripcion.unsubscribe(); // claves VAPID rotadas
    suscripcion = null;
  }
  suscripcion ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });

  const json = suscripcion.toJSON();
  const r = await guardarSuscripcionPush({
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
  });
  return r.success;
}

/** Pide permiso (debe llamarse desde un clic) y suscribe el navegador si se concede. */
export async function solicitarNotificaciones(): Promise<NotificationPermission | "no-soportado"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "no-soportado";
  const permiso = await Notification.requestPermission();
  if (permiso === "granted") await sincronizarSuscripcionPush().catch(() => false);
  return permiso;
}

/** Al cerrar sesión: este dispositivo deja de recibir avisos de la cuenta. Nunca lanza. */
export async function desuscribirEsteNavegador(): Promise<void> {
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    const suscripcion = await registro?.pushManager.getSubscription();
    if (!suscripcion) return;
    await eliminarSuscripcionPush(suscripcion.endpoint);
    await suscripcion.unsubscribe();
  } catch {
    /* sin soporte o sin red: el servidor limpia suscripciones caducadas al enviar */
  }
}
