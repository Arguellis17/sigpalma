"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Loader2 } from "lucide-react";

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
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(32,104,56,0.14),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(166,120,47,0.12),_transparent_30%),linear-gradient(180deg,#f8faf5_0%,#f4efe4_100%)] p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.18]" />
      <div className="pointer-events-none absolute -left-20 top-10 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 size-96 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative flex max-w-sm flex-col items-center gap-5 text-center">
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
