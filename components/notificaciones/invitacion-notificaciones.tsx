"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { solicitarNotificaciones, sincronizarSuscripcionPush } from "@/lib/notificaciones/push-cliente";

type Permiso = NotificationPermission | "no-soportado";

const CLAVE_INVITACION = "sigpalma:notificaciones-invitacion-descartada";

// ── Permiso del navegador como store externo (SSR-safe y reactivo a cambios del usuario) ──────
const oyentes = new Set<() => void>();
function suscribirPermiso(cb: () => void) {
  oyentes.add(cb);
  let estado: PermissionStatus | null = null;
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((s) => {
      estado = s;
      s.onchange = () => oyentes.forEach((f) => f());
    })
    .catch(() => {});
  return () => {
    oyentes.delete(cb);
    if (estado) estado.onchange = null;
  };
}

export const leerPermisoNotificaciones = (): Permiso =>
  "Notification" in window ? Notification.permission : "no-soportado";

export function usePermisoNotificaciones(): Permiso {
  return useSyncExternalStore<Permiso>(suscribirPermiso, leerPermisoNotificaciones, () => "no-soportado");
}

function leerInvitacionDescartada(): boolean {
  try {
    return localStorage.getItem(CLAVE_INVITACION) === "1";
  } catch {
    return false;
  }
}

/**
 * Tarjeta "Activar notificaciones" (Web Push). Con permiso ya concedido no se muestra y solo
 * sincroniza la suscripción de este dispositivo con la cuenta en sesión.
 */
export function InvitacionNotificaciones({ texto }: { texto: string }) {
  const permiso = usePermisoNotificaciones();
  const [descartadaAhora, setDescartadaAhora] = useState(false);
  const descartadaGuardada = useSyncExternalStore(() => () => {}, leerInvitacionDescartada, () => true);

  useEffect(() => {
    if (permiso === "granted") void sincronizarSuscripcionPush().catch(() => false);
  }, [permiso]);

  async function activar() {
    await solicitarNotificaciones();
    oyentes.forEach((f) => f());
  }

  function descartar() {
    try {
      localStorage.setItem(CLAVE_INVITACION, "1");
    } catch {
      /* sin almacenamiento: solo se oculta en esta sesión */
    }
    setDescartadaAhora(true);
  }

  if (permiso !== "default" || descartadaAhora || descartadaGuardada) return null;

  return (
    <div className="pointer-events-auto rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm leading-5">{texto}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="min-h-10 rounded-xl" onClick={activar}>
              Activar notificaciones
            </Button>
            <Button type="button" size="sm" variant="ghost" className="min-h-10 rounded-xl" onClick={descartar}>
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
