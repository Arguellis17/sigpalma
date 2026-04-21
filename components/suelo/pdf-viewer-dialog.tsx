"use client";

import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { PdfViewerBody } from "./pdf-viewer-body";

type PdfViewerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL firmada o pública del PDF */
  fileUrl: string | null;
  title?: string;
};

/**
 * Visor casi a pantalla completa: deja un margen para que el overlay reciba clics y cierre el diálogo.
 * Escape: listener global en fase captura (el iframe suele robar el foco y Radix no recibe Esc).
 */
export function PdfViewerDialog({
  open,
  onOpenChange,
  fileUrl,
  title = "Informe de laboratorio (PDF)",
}: PdfViewerDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 p-0 shadow-2xl",
          "!fixed !left-3 !top-3 !right-3 !bottom-3 !translate-x-0 !translate-y-0",
          "!h-[calc(100dvh-1.5rem)] !max-h-[calc(100dvh-1.5rem)] !w-[calc(100vw-1.5rem)] !max-w-none",
          "flex flex-col overflow-hidden rounded-xl border bg-background sm:!left-4 sm:!right-4 sm:!top-4 sm:!bottom-4 sm:!h-[calc(100dvh-2rem)] sm:!max-h-[calc(100dvh-2rem)] sm:!w-[calc(100vw-2rem)]",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-95"
        )}
      >
        <DialogDescription id="pdf-viewer-desc" className="sr-only">
          Vista del informe en PDF. Pulse Escape, el botón cerrar o haga clic fuera de esta ventana para
          volver.
        </DialogDescription>

        <DialogHeader className="shrink-0 space-y-0 border-b border-border/70 px-4 py-3 pr-14 text-left">
          <DialogTitle className="text-base font-bold leading-snug">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {open && fileUrl ? <PdfViewerBody fileUrl={fileUrl} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
