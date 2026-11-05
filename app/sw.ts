/// <reference lib="webworker" />
// Service worker de SIG-Palma (Serwist): app instalable, páginas y recursos disponibles sin
// conexión, página de respaldo offline, notificaciones Web Push y aviso de Background Sync
// para la cola de registros pendientes (lib/offline).
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Etiqueta de Background Sync registrada por la cola offline (lib/offline/sincronizador.ts). */
const ETIQUETA_SYNC = "sigpalma-sincronizar";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API propia: sincronización, exportaciones y reportes nunca se sirven desde caché.
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/v1/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// ── Web Push ───────────────────────────────────────────────────────────────────────────────
// Payload (lib/push/enviar.ts): { title, body, url, tag, requireInteraction }.
self.addEventListener("push", (event) => {
  let datos: { title?: string; body?: string; url?: string; tag?: string; requireInteraction?: boolean } = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(datos.title || "SIG-Palma", {
      body: datos.body || "",
      tag: datos.tag || undefined,
      requireInteraction: Boolean(datos.requireInteraction),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string } | undefined)?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin) as WindowClient | undefined;
      if (abierta) return abierta.focus().then((v) => v.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});

// ── Background Sync (Chromium): al volver la señal, pide a las pestañas abiertas sincronizar ──
type SyncEvent = ExtendableEvent & { tag: string };
self.addEventListener("sync", ((event: SyncEvent) => {
  if (event.tag !== ETIQUETA_SYNC) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((ventanas) => {
      for (const v of ventanas) v.postMessage({ tipo: "sincronizar" });
    })
  );
}) as EventListener);
