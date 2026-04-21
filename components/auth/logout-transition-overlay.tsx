"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { AuthPageBackdrop } from "@/components/auth/auth-page-backdrop";

type LogoutTransitionOverlayProps = {
  open: boolean;
};

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function LogoutTransitionOverlay({ open }: LogoutTransitionOverlayProps) {
  const isClient = useIsClient();

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[9999] isolate flex flex-col items-center justify-center gap-6 bg-background p-6 text-foreground"
    >
      <AuthPageBackdrop />

      <div className="relative z-10 flex max-w-sm flex-col items-center gap-5 text-center">
        <Image
          src="/logo.png"
          alt="SIG-Palma"
          width={160}
          height={160}
          priority
          className="h-24 w-auto sm:h-28"
        />
        <p className="text-base font-medium tracking-tight text-foreground sm:text-lg">
          Cerrando sesión…
        </p>
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
