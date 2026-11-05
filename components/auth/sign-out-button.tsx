"use client";

import { useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { desuscribirEsteNavegador } from "@/lib/notificaciones/push-cliente";
import { LogoutTransitionOverlay } from "@/components/auth/logout-transition-overlay";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOfflineOpcional } from "@/components/offline/estado-offline";
import { limpiarAlCerrarSesion } from "@/lib/offline/cola";

type SignOutButtonProps = {
  className?: string;
  label?: string;
  labelClassName?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
};

export function SignOutButton({
  className,
  label = "Cerrar sesión",
  labelClassName,
  variant = "outline",
  size = "lg",
}: SignOutButtonProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [avisoPendientes, setAvisoPendientes] = useState(false);
  const offline = useOfflineOpcional();
  const pendientes = offline?.pendientes ?? 0;

  async function signOut(confirmado = false) {
    if (loggingOut) return;
    // Offline-first: avisar antes de salir si hay registros que aún no llegan al servidor.
    if (pendientes > 0 && !confirmado) {
      setAvisoPendientes(true);
      return;
    }
    setAvisoPendientes(false);
    setLoggingOut(true);
    try {
      // Antes de cerrar sesión: este dispositivo deja de recibir notificaciones de la cuenta.
      await desuscribirEsteNavegador();
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (offline) await limpiarAlCerrarSesion(offline.userId, pendientes === 0);
      router.refresh();
      router.push("/auth/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <LogoutTransitionOverlay open={loggingOut} />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className ?? "min-h-12 min-w-[140px]"}
        onClick={() => signOut()}
        disabled={loggingOut}
      >
        <LogOut data-icon="inline-start" />
        <span className={labelClassName}>{label}</span>
      </Button>
      <Dialog open={avisoPendientes} onOpenChange={setAvisoPendientes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hay {pendientes} registro{pendientes === 1 ? "" : "s"} sin sincronizar</DialogTitle>
            <DialogDescription>
              {offline?.enLinea
                ? "Sincronice antes de salir para que el resto del equipo los vea."
                : "No hay conexión. Si cierra sesión, se conservarán en este dispositivo y se enviarán cuando vuelva a iniciar sesión con su cuenta."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            {offline?.enLinea ? (
              <Button type="button" className="min-h-12" onClick={() => offline.sincronizarAhora()}>
                Sincronizar ahora
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="min-h-12" onClick={() => signOut(true)}>
              Cerrar sesión de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
