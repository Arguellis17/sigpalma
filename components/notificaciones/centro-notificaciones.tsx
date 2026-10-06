"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, ClipboardList, ShieldAlert, Trash2, X } from "lucide-react";
import {
  eliminarNotificaciones,
  listarNotificaciones,
  marcarNotificacionesLeidas,
  type NotificacionRow,
} from "@/app/actions/notificaciones";
import { InvitacionNotificaciones } from "@/components/notificaciones/invitacion-notificaciones";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { etiquetaContador, tiempoRelativo } from "@/lib/notificaciones/centro";
import { cn } from "@/lib/utils";

type Props = { usuarioId: string; textoInvitacion: string };

const MAX_AVISOS = 3;
/** Los avisos flotantes no urgentes se ocultan solos; quedan guardados en el centro. */
const DURACION_AVISO_MS = 12000;

const BORDE_SEVERIDAD: Record<string, string> = {
  baja: "border-l-sky-500",
  media: "border-l-amber-500",
  alta: "border-l-orange-600",
  critica: "border-l-red-600",
};

function esUrgente(n: NotificacionRow) {
  return n.severidad === "alta" || n.severidad === "critica";
}

function Icono({ n, className }: { n: NotificacionRow; className?: string }) {
  if (n.tipo === "monitoreo_asignado") return <ClipboardList className={cn("text-primary", className)} aria-hidden />;
  if (esUrgente(n)) return <ShieldAlert className={cn("text-red-600", className)} aria-hidden />;
  return <BellRing className={cn("text-amber-600", className)} aria-hidden />;
}

/**
 * Centro de notificaciones: campana con contador en la cabecera, bandeja (ver, abrir, marcar
 * leída, eliminar) y avisos en vivo. Las filas nuevas llegan por Realtime (Postgres Changes sobre
 * `notificaciones`, filtrado por usuario y protegido por RLS); con la app cerrada, por Web Push.
 */
export function CentroNotificaciones({ usuarioId, textoInvitacion }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotificacionRow[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "no-leidas">("todas");
  const [avisos, setAvisos] = useState<NotificacionRow[]>([]);
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const recargar = useCallback(async () => {
    const r = await listarNotificaciones();
    if (r.success) {
      setItems(r.data.items);
      setNoLeidas(r.data.noLeidas);
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    void listarNotificaciones().then((r) => {
      if (!vigente || !r.success) return;
      setItems(r.data.items);
      setNoLeidas(r.data.noLeidas);
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelado = false;
    const canal = supabase.channel(`notificaciones:${usuarioId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notificaciones", filter: `user_id=eq.${usuarioId}` },
      (payload) => {
        const n = payload.new as NotificacionRow;
        setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
        setNoLeidas((c) => c + 1);
        setAvisos((prev) => [n, ...prev].slice(0, MAX_AVISOS));
        if (!esUrgente(n)) {
          setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== n.id)), DURACION_AVISO_MS);
        }
        routerRef.current.refresh(); // listas y contadores renderizados en servidor
      }
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
  }, [usuarioId]);

  function quitarAviso(id: string) {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
  }

  async function marcarLeidas(ids?: string[]) {
    const ahora = new Date().toISOString();
    setItems((prev) => prev.map((n) => (!ids || ids.includes(n.id)) && !n.leida_at ? { ...n, leida_at: ahora } : n));
    setNoLeidas((c) => (ids ? Math.max(0, c - items.filter((n) => ids.includes(n.id) && !n.leida_at).length) : 0));
    await marcarNotificacionesLeidas(ids);
  }

  async function eliminar(ids: string[]) {
    setNoLeidas((c) => Math.max(0, c - items.filter((n) => ids.includes(n.id) && !n.leida_at).length));
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    await eliminarNotificaciones({ ids });
  }

  async function eliminarLeidas() {
    setItems((prev) => prev.filter((n) => !n.leida_at));
    await eliminarNotificaciones({ soloLeidas: true });
  }

  function abrir(n: NotificacionRow) {
    quitarAviso(n.id);
    setAbierto(false);
    if (!n.leida_at) void marcarLeidas([n.id]);
    router.push(n.url);
  }

  const visibles = filtro === "no-leidas" ? items.filter((n) => !n.leida_at) : items;
  const contador = etiquetaContador(noLeidas);
  const hayLeidas = items.some((n) => n.leida_at);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-10 shrink-0 rounded-xl"
        onClick={() => {
          setAbierto(true);
          void recargar();
        }}
        aria-label={contador ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
      >
        <Bell className="size-5" />
        {contador ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white">
            {contador}
          </span>
        ) : null}
      </Button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/70 p-4 pr-12">
            <SheetTitle>Notificaciones</SheetTitle>
            <SheetDescription>
              {noLeidas > 0 ? `${noLeidas} sin leer` : "Está al día"} · se guardan las últimas 50.
            </SheetDescription>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-border/70 p-0.5" role="tablist" aria-label="Filtrar notificaciones">
                {(["todas", "no-leidas"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={filtro === f}
                    onClick={() => setFiltro(f)}
                    className={cn(
                      "min-h-9 rounded-lg px-3 text-sm",
                      filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f === "todas" ? "Todas" : "No leídas"}
                  </button>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" className="min-h-9 gap-1.5" disabled={noLeidas === 0} onClick={() => void marcarLeidas()}>
                <CheckCheck className="size-4" />
                Marcar todas
              </Button>
              <Button type="button" variant="ghost" size="sm" className="min-h-9 gap-1.5" disabled={!hayLeidas} onClick={() => void eliminarLeidas()}>
                <Trash2 className="size-4" />
                Borrar leídas
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {visibles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
                <Bell className="size-8 opacity-40" aria-hidden />
                {filtro === "no-leidas" ? "No tiene notificaciones sin leer." : "Aún no tiene notificaciones."}
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {visibles.map((n) => (
                  <li key={n.id} className={cn("group relative flex gap-3 px-4 py-3", !n.leida_at && "bg-primary/5")}>
                    <button type="button" className="flex min-w-0 flex-1 gap-3 text-left" onClick={() => abrir(n)}>
                      <Icono n={n} className="mt-0.5 size-5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm leading-5", !n.leida_at ? "font-semibold" : "font-medium text-muted-foreground")}>
                          {n.titulo}
                        </span>
                        {n.cuerpo ? <span className="mt-0.5 line-clamp-2 block text-sm leading-5 text-muted-foreground">{n.cuerpo}</span> : null}
                        <span className="mt-1 block text-xs text-muted-foreground">{tiempoRelativo(n.created_at)}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      {!n.leida_at ? (
                        <button
                          type="button"
                          onClick={() => void marcarLeidas([n.id])}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Marcar como leída"
                          title="Marcar como leída"
                        >
                          <CheckCheck className="size-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void eliminar([n.id])}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Eliminar notificación"
                        title="Eliminar"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {!n.leida_at ? <span className="absolute left-1.5 top-5 size-2 rounded-full bg-primary" aria-hidden /> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Avisos en vivo + invitación a activar notificaciones del navegador */}
      <div className="pointer-events-none fixed inset-x-4 top-20 z-[90] flex flex-col gap-3 sm:left-auto sm:right-6 sm:w-96">
        <InvitacionNotificaciones texto={textoInvitacion} />
        {avisos.map((n) => (
          <div
            key={n.id}
            role={esUrgente(n) ? "alert" : "status"}
            aria-live={esUrgente(n) ? "assertive" : "polite"}
            className={cn(
              "pointer-events-auto relative rounded-2xl border border-l-4 bg-background/95 p-4 pr-10 shadow-xl backdrop-blur animate-in slide-in-from-top-4 fade-in-0",
              n.severidad ? BORDE_SEVERIDAD[n.severidad] : "border-l-primary"
            )}
          >
            <div className="flex items-start gap-3">
              <Icono n={n} className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{n.titulo}</p>
                {n.cuerpo ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{n.cuerpo}</p> : null}
                <Button type="button" size="sm" className="mt-3 min-h-10 rounded-xl" onClick={() => abrir(n)}>
                  {n.tipo === "monitoreo_asignado" ? "Ver mis monitoreos" : "Revisar"}
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => quitarAviso(n.id)}
              className="absolute right-2 top-2 rounded-lg p-2 opacity-60 hover:opacity-100"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
