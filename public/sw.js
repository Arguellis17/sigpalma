// Service worker mínimo de SIG-Palma: solo muestra/gestiona notificaciones del navegador.
// Necesario porque Chrome en Android no permite `new Notification()` fuera de un service worker.
// No intercepta peticiones ni guarda caché.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Web Push: llega aunque no haya ninguna pestaña de SIG-Palma abierta.
// Payload (lib/push/enviar.ts): { title, body, url, tag, requireInteraction }.
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : "" };
  }
  const titulo = datos.title || "SIG-Palma";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || "",
      tag: datos.tag || undefined,
      renotify: Boolean(datos.tag),
      requireInteraction: Boolean(datos.requireInteraction),
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/tecnico/sanidad/validacion", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      if (abierta) {
        return abierta.focus().then((v) => (v && "navigate" in v ? v.navigate(url) : v));
      }
      return self.clients.openWindow(url);
    })
  );
});
