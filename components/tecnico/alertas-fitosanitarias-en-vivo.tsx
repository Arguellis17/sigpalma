"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  RUTA_VALIDACION,
  construirNotificacion,
  debeNotificar,
  etiquetaSeveridad,
  type AlertaInsertada,
  type NotificacionAlerta,
} from "@/lib/notificaciones/alerta-fitosanitaria";

type Props = { usuarioId: string; fincaId: string };

type Permiso = NotificationPermission | "no-soportado";

const CLAVE_INVITACION = "sigpalma:notificaciones-invitacion-descartada";
const MAX_AVISOS = 4;

// ── Permiso de notificaciones del navegador como store externo (SSR-safe) ─────────────────────
const oyentesPermiso = new Set<() => void>();
function suscribirPermiso(cb: () => void) {
  oyentesPermiso.add(cb);
  let estado: PermissionStatus | null = null;
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((s) => {
      estado = s;
      s.onchange = () => oyentesPermiso.forEach((f) => f());
    })
    .catch(() => {});
  return () => {
    oyentesPermiso.delete(cb);
    if (estado) estado.onchange = null;
  };
}
const leerPermiso = (): Permiso => ("Notification" in window ? Notification.permission : "no-soportado");
const avisarPermiso = () => oyentesPermiso.forEach((f) => f());

function leerInvitacionDescartada(): boolean {
  try {
    return localStorage.getItem(CLAVE_INVITACION) === "1";
  } catch {
    return false;
  }
}

async function mostrarEnSistema(n: NotificacionAlerta, alHacerClic: () => void) {
  const opciones: NotificationOptions = {
    body: n.cuerpo,
    tag: n.id,
    icon: "/logo.png",
    badge: "/logo.png",
    requireInteraction: n.urgente,
    data: { url: RUTA_VALIDACION },
  };
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    if (registro) {
      await registro.showNotification(n.titulo, opciones);
      return;
    }
  } catch {
    /* se intenta con la API directa */
  }
  try {
    const notif = new Notification(n.titulo, opciones);
    notif.onclick = () => {
      window.focus();
      alHacerClic();
      notif.close();
    };
  } catch {
    /* navegador sin soporte: queda el aviso dentro de la app */
  }
}

const ESTILO_SEVERIDAD: Record<NotificacionAlerta["severidad"], string> = {
  baja: "border-l-sky-500",
  media: "border-l-amber-500",
  alta: "border-l-orange-600",
  critica: "border-l-red-600",
};

/**
 * Alertas fitosanitarias en tiempo real para el técnico: Supabase Realtime (Postgres Changes,
 * filtrado por finca y protegido por RLS) + aviso en pantalla + notificación del navegador.
 */
export function AlertasFitosanitariasEnVivo({ usuarioId, fincaId }: Props) {
  const router = useRouter();
  const [avisos, setAvisos] = useState<NotificacionAlerta[]>([]);
  const [invitacionDescartada, setInvitacionDescartada] = useState(false);
  const permiso = useSyncExternalStore<Permiso>(suscribirPermiso, leerPermiso, () => "no-soportado");
  const descartadaGuardada = useSyncExternalStore(
    () => () => {},
    leerInvitacionDescartada,
    () => true
  );
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let cancelado = false;

    async function manejar(alerta: AlertaInsertada) {
      if (!debeNotificar(alerta, usuarioId, fincaId)) return;
      const { data } = await supabase
        .from("alertas_fitosanitarias")
        .select("lotes ( codigo ), catalogo_items ( nombre )")
        .eq("id", alerta.id)
        .maybeSingle();
      if (cancelado) return;
      const fila = data as { lotes?: { codigo?: string } | null; catalogo_items?: { nombre?: string } | null } | null;
      const aviso = construirNotificacion(alerta, {
        loteCodigo: fila?.lotes?.codigo ?? null,
        plaga: fila?.catalogo_items?.nombre ?? null,
      });
      setAvisos((prev) => [aviso, ...prev.filter((a) => a.id !== aviso.id)].slice(0, MAX_AVISOS));
      routerRef.current.refresh(); // listas de validación/alertas renderizadas en servidor
      if (leerPermiso() === "granted" && !document.hasFocus()) {
        void mostrarEnSistema(aviso, () => routerRef.current.push(RUTA_VALIDACION));
      }
    }

    const canal = supabase.channel(`alertas-fitosanitarias:${fincaId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "alertas_fitosanitarias",
        filter: `finca_id=eq.${fincaId}`,
      },
      (payload) => void manejar(payload.new as AlertaInsertada)
    );

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (!cancelado) canal.subscribe();
    })();

    return () => {
      cancelado = true;
      void supabase.removeChannel(canal);
    };
  }, [usuarioId, fincaId]);

  // Con permiso ya concedido, registra el service worker (necesario en Android).
  useEffect(() => {
    if (permiso === "granted" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [permiso]);

  async function activarNotificaciones() {
    if (!("Notification" in window)) return;
    const resultado = await Notification.requestPermission();
    avisarPermiso();
    if (resultado === "granted" && "serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }

  function descartarInvitacion() {
    try {
      localStorage.setItem(CLAVE_INVITACION, "1");
    } catch {
      /* sin almacenamiento: solo se oculta en esta sesión */
    }
    setInvitacionDescartada(true);
  }

  const cerrar = (id: string) => setAvisos((prev) => prev.filter((a) => a.id !== id));
  const mostrarInvitacion = permiso === "default" && !invitacionDescartada && !descartadaGuardada;

  if (avisos.length === 0 && !mostrarInvitacion) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 top-20 z-[90] flex flex-col gap-3 sm:left-auto sm:right-6 sm:w-96">
      {mostrarInvitacion ? (
        <div className="pointer-events-auto rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm leading-5">
                Active las notificaciones para enterarse de los reportes fitosanitarios aunque esté en otra
                pestaña o aplicación.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="min-h-10 rounded-xl" onClick={activarNotificaciones}>
                  Activar notificaciones
                </Button>
                <Button type="button" size="sm" variant="ghost" className="min-h-10 rounded-xl" onClick={descartarInvitacion}>
                  Ahora no
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.urgente ? "alert" : "status"}
          aria-live={a.urgente ? "assertive" : "polite"}
          className={cn(
            "pointer-events-auto relative rounded-2xl border border-l-4 bg-background/95 p-4 pr-10 shadow-xl backdrop-blur animate-in slide-in-from-top-4 fade-in-0",
            ESTILO_SEVERIDAD[a.severidad]
          )}
        >
          <div className="flex items-start gap-3">
            {a.urgente ? (
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
            ) : (
              <BellRing className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{a.titulo}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{a.cuerpo}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button asChild size="sm" className="min-h-10 rounded-xl">
                  <Link href={RUTA_VALIDACION} onClick={() => cerrar(a.id)}>
                    Revisar
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">Severidad {etiquetaSeveridad(a.severidad)}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => cerrar(a.id)}
            className="absolute right-2 top-2 rounded-lg p-2 opacity-60 hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
