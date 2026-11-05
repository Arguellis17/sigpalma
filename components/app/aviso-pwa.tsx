"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Evento de Chromium para ofrecer la instalación (no está en los tipos del DOM). */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const CLAVE_OCULTO = "sigpalma-instalar-oculto";
const OCULTO_DIAS = 14;
/** Cada cuánto se busca una versión nueva con la app abierta (además de al volver a la pestaña). */
const REVISAR_CADA_MS = 30 * 60_000;

function instalarOculto(): boolean {
  try {
    const t = Number(localStorage.getItem(CLAVE_OCULTO) ?? 0);
    return Date.now() - t < OCULTO_DIAS * 86_400_000;
  } catch {
    return false;
  }
}

function esStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function esIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Avisos de la PWA:
 * - Versión nueva: el service worker nuevo queda en espera y se activa solo cuando el usuario toca
 *   «Actualizar» (no cambia la app a mitad de un formulario). Los registros sin enviar están en el
 *   dispositivo y no se pierden al recargar.
 * - Instalar: los navegadores no muestran un aviso propio; este botón usa el de Chrome/Edge/Android y
 *   en iPhone explica cómo agregarla a la pantalla de inicio.
 */
export function AvisoPwa() {
  const [enEspera, setEnEspera] = useState<ServiceWorker | null>(null);
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null);
  const [ayudaIos, setAyudaIos] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const recargar = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let intervalo: number | undefined;
    const sw = navigator.serviceWorker;
    const revisar = () =>
      void sw
        .getRegistration()
        .then((reg) => reg?.update())
        .catch(() => undefined);
    const alVolver = () => {
      if (document.visibilityState === "visible") revisar();
    };

    // Con un service worker previo controlando la página, uno nuevo instalado = versión nueva.
    void sw.ready
      .then((reg) => {
        if (reg.waiting && sw.controller) setEnEspera(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nuevo = reg.installing;
          nuevo?.addEventListener("statechange", () => {
            if (nuevo.state === "installed" && sw.controller) setEnEspera(nuevo);
          });
        });
        intervalo = window.setInterval(revisar, REVISAR_CADA_MS);
        document.addEventListener("visibilitychange", alVolver);
      })
      .catch(() => undefined);

    const alCambiar = () => {
      if (recargar.current) window.location.reload();
    };
    sw.addEventListener("controllerchange", alCambiar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      sw.removeEventListener("controllerchange", alCambiar);
    };
  }, []);

  useEffect(() => {
    if (esStandalone()) return;
    const alOfrecer = (e: Event) => {
      e.preventDefault();
      if (!instalarOculto()) setInstalar(e as EventoInstalar);
    };
    const alInstalar = () => setInstalar(null);
    window.addEventListener("beforeinstallprompt", alOfrecer);
    window.addEventListener("appinstalled", alInstalar);
    // Safari en iPhone no dispara beforeinstallprompt: se explica el paso manual.
    const id = window.setTimeout(() => {
      if (esIos() && !instalarOculto()) setAyudaIos(true);
    }, 1500);
    return () => {
      window.removeEventListener("beforeinstallprompt", alOfrecer);
      window.removeEventListener("appinstalled", alInstalar);
      window.clearTimeout(id);
    };
  }, []);

  function actualizar() {
    if (!enEspera) return;
    setActualizando(true);
    recargar.current = true;
    enEspera.postMessage({ type: "SKIP_WAITING" });
    // Respaldo si el navegador no avisa el cambio de controlador.
    window.setTimeout(() => window.location.reload(), 4000);
  }

  async function pedirInstalacion() {
    if (!instalar) return;
    await instalar.prompt();
    await instalar.userChoice.catch(() => undefined);
    setInstalar(null);
  }

  function ocultarInstalar() {
    try {
      localStorage.setItem(CLAVE_OCULTO, String(Date.now()));
    } catch {
      /* sin almacenamiento: solo se oculta en esta visita */
    }
    setInstalar(null);
    setAyudaIos(false);
  }

  const tarjeta =
    "fixed inset-x-4 bottom-4 z-[90] mx-auto flex max-w-md items-start gap-3 rounded-2xl border bg-background p-4 shadow-lg sm:left-6 sm:right-auto sm:mx-0";

  if (enEspera) {
    return (
      <div role="status" aria-live="polite" className={tarjeta} data-testid="aviso-version-nueva">
        <RefreshCw className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Hay una versión nueva de SIG-Palma</p>
          <p className="text-sm text-muted-foreground">
            Termine lo que esté registrando y actualice. Los registros guardados en el dispositivo no se pierden.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" className="min-h-11" onClick={actualizar} disabled={actualizando}>
              {actualizando ? "Actualizando…" : "Actualizar"}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setEnEspera(null)}>
              Más tarde
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (instalar || ayudaIos) {
    return (
      <div role="dialog" aria-label="Instalar SIG-Palma" className={tarjeta} data-testid="aviso-instalar">
        {instalar ? (
          <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <Share className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Instale SIG-Palma en este dispositivo</p>
          <p className="text-sm text-muted-foreground">
            {instalar
              ? "Se abre como una aplicación y funciona sin conexión en el campo."
              : "En Safari toque Compartir y luego «Agregar a inicio». Se abre como aplicación y funciona sin conexión."}
          </p>
          {instalar ? (
            <Button type="button" className="mt-3 min-h-11" onClick={() => void pedirInstalacion()}>
              Instalar app
            </Button>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Ahora no" onClick={ocultarInstalar}>
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return null;
}
