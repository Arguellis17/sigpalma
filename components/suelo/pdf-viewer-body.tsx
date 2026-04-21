"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  fileUrl: string;
  /** Se dispara cuando el visor del navegador terminó de cargar el PDF */
  onLoaded?: () => void;
};

function iframeSrc(fileUrl: string): string {
  try {
    const u = new URL(fileUrl);
    u.hash = "toolbar=1&navpanes=0";
    return u.toString();
  } catch {
    const noHash = fileUrl.split("#")[0] ?? fileUrl;
    return `${noHash}#toolbar=1&navpanes=0`;
  }
}

/**
 * PDF en iframe (sin pdf.js). Incluye estado de carga para mejor UX.
 */
export function PdfViewerBody({ fileUrl, onLoaded }: Props) {
  const [loading, setLoading] = useState(true);
  const src = useMemo(() => iframeSrc(fileUrl), [fileUrl]);

  useEffect(() => {
    setLoading(true);
  }, [fileUrl]);

  function handleLoad() {
    setLoading(false);
    onLoaded?.();
  }

  return (
    <div className="relative min-h-0 flex-1 bg-[#eceff1] dark:bg-neutral-950">
      {loading ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Cargando documento…</p>
        </div>
      ) : null}
      <iframe
        title="Vista previa del informe PDF"
        src={src}
        className="size-full min-h-[50dvh] border-0 sm:min-h-0"
        onLoad={handleLoad}
      />
    </div>
  );
}
