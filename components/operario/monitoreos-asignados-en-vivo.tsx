"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, X } from "lucide-react";
import { InvitacionNotificaciones } from "@/components/notificaciones/invitacion-notificaciones";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  EVENTO_MONITOREO_ASIGNADO,
  RUTA_MONITOREOS_OPERARIO,
  canalMonitoreosOperario,
  construirAvisoMonitoreo,
  type MonitoreoAsignadoPayload,
} from "@/lib/notificaciones/monitoreo-asignado";

type Aviso = { id: string; titulo: string; cuerpo: string };

const MAX_AVISOS = 4;

/**
 * Avisos en tiempo real al operario cuando le asignan un monitoreo: canal privado Broadcast
 * `monitoreos:<id>` (solo él puede escucharlo, RLS en realtime.messages). Con la app cerrada,
 * llega por Web Push.
 */
export function MonitoreosAsignadosEnVivo({ operarioId }: { operarioId: string }) {
  const router = useRouter();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let cancelado = false;

    const canal = supabase
      .channel(canalMonitoreosOperario(operarioId), { config: { private: true } })
      .on("broadcast", { event: EVENTO_MONITOREO_ASIGNADO }, ({ payload }) => {
        const p = payload as MonitoreoAsignadoPayload;
        const { titulo, cuerpo } = construirAvisoMonitoreo(p);
        setAvisos((prev) => [{ id: p.monitoreoId, titulo, cuerpo }, ...prev.filter((a) => a.id !== p.monitoreoId)].slice(0, MAX_AVISOS));
        routerRef.current.refresh(); // contador de pendientes y lista de monitoreos
      });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (!cancelado) canal.subscribe();
    })();

    return () => {
      cancelado = true;
      void supabase.removeChannel(canal);
    };
  }, [operarioId]);

  const cerrar = (id: string) => setAvisos((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="pointer-events-none fixed inset-x-4 top-20 z-[90] flex flex-col gap-3 sm:left-auto sm:right-6 sm:w-96">
      <InvitacionNotificaciones texto="Active las notificaciones para enterarse cuando le asignen un monitoreo, aunque tenga la aplicación cerrada." />

      {avisos.map((a) => (
        <div
          key={a.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto relative rounded-2xl border border-l-4 border-l-primary bg-background/95 p-4 pr-10 shadow-xl backdrop-blur animate-in slide-in-from-top-4 fade-in-0"
        >
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{a.titulo}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{a.cuerpo}</p>
              <Button asChild size="sm" className="mt-3 min-h-11 rounded-xl">
                <Link href={RUTA_MONITOREOS_OPERARIO} onClick={() => cerrar(a.id)}>
                  Ver mis monitoreos
                </Link>
              </Button>
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
