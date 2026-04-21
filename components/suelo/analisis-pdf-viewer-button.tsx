"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import { obtenerUrlDescargaAnalisisSuelo } from "@/app/actions/suelo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { PdfViewerDialog } from "./pdf-viewer-dialog";

type Props = {
  analisisId: string;
  /** Presentación: enlace compacto en tabla o botón con icono */
  variant?: "link" | "outline";
  className?: string;
};

export function AnalisisPdfViewerButton({
  analisisId,
  variant = "link",
  className,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    const res = await obtenerUrlDescargaAnalisisSuelo(analisisId);
    setLoading(false);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    setFileUrl(res.data.url);
    setOpen(true);
  }

  function handleDialogOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setFileUrl(null);
    }
  }

  if (variant === "outline") {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("gap-1.5 rounded-xl", className)}
          disabled={loading}
          onClick={handleOpen}
        >
          <FileText className="size-3.5 text-red-600 dark:text-red-400" />
          {loading ? "Abriendo…" : "Ver PDF"}
        </Button>
        <PdfViewerDialog
          open={open}
          onOpenChange={handleDialogOpenChange}
          fileUrl={fileUrl}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="link"
        className={cn("h-auto p-0 text-xs", className)}
        disabled={loading}
        onClick={handleOpen}
      >
        {loading ? "Abriendo…" : "Ver PDF"}
      </Button>
      <PdfViewerDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        fileUrl={fileUrl}
      />
    </>
  );
}
