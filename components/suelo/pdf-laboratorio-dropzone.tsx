"use client";

import { useId, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

function assignPdfToInput(input: HTMLInputElement, file: File) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
}

type PdfLaboratorioDropzoneProps = {
  /** Nombre del campo en el formulario (multipart). */
  name?: string;
  disabled?: boolean;
  /** Muestra aviso si ya hay PDF en el servidor (modo edición). */
  hasExistingFile?: boolean;
  /** Menos padding (p. ej. modal). */
  compact?: boolean;
  className?: string;
};

export function PdfLaboratorioDropzone({
  name = "archivo",
  disabled,
  hasExistingFile,
  compact = false,
  className,
}: PdfLaboratorioDropzoneProps) {
  const inputId = useId();
  const descId = `${inputId}-desc`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function validateAndSet(file: File): boolean {
    setHint(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setHint("El archivo debe ser un PDF.");
      return false;
    }
    if (file.size > MAX_PDF_BYTES) {
      setHint("El PDF no puede superar 5 MB.");
      return false;
    }
    if (!inputRef.current) return false;
    assignPdfToInput(inputRef.current, file);
    setSelectedName(file.name);
    return true;
  }

  function clearSelection() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setSelectedName(null);
    setHint(null);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      clearSelection();
      return;
    }
    validateAndSet(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    validateAndSet(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={onInputChange}
        aria-invalid={hint ? true : undefined}
        aria-describedby={descId}
      />

      <Card
        size="sm"
        className={cn(
          "overflow-hidden transition-colors",
          compact && "shadow-none"
        )}
      >
        <CardHeader
          className={cn(
            "border-b border-border/60 bg-muted/15 pb-3",
            compact ? "px-3 pt-3" : "px-4 pt-4"
          )}
        >
          <CardTitle className="flex items-center gap-2 text-base font-semibold leading-tight">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-600/12 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <FileText className="size-4" strokeWidth={2.25} aria-hidden />
            </span>
            Informe del laboratorio
          </CardTitle>
          <CardDescription id={descId} className="text-xs leading-snug">
            Opcional · solo PDF · máximo 5 MB · almacenamiento privado para auditoría.
          </CardDescription>
        </CardHeader>

        <CardContent className={cn("space-y-2", compact ? "px-3 py-3" : "px-4 py-3")}>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={cn(
              "rounded-xl border-2 border-dashed transition-colors",
              isDragging && "border-primary bg-primary/5 ring-2 ring-primary/25",
              !isDragging && "border-border/70 bg-muted/20",
              hint && "border-destructive/50",
              compact ? "p-2.5" : "p-3"
            )}
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <label
                htmlFor={inputId}
                className={cn(
                  "min-w-0 cursor-pointer text-sm leading-snug text-muted-foreground",
                  disabled && "pointer-events-none cursor-not-allowed opacity-60"
                )}
              >
                <span className="text-foreground">Arrastra el PDF</span> o pulsa{" "}
                <span className="font-medium text-primary">Examinar</span>.
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full shrink-0 rounded-xl sm:w-auto"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mr-1.5 size-3.5" aria-hidden />
                Examinar archivos
              </Button>
            </div>
          </div>

          {selectedName ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1.5 text-left text-sm">
              <span className="min-w-0 flex-1 truncate font-medium" title={selectedName}>
                {selectedName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-lg"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
                aria-label="Quitar archivo seleccionado"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : null}

          {hasExistingFile && !selectedName ? (
            <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
              Ya hay un informe adjunto; un PDF nuevo lo reemplaza.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {hint ? (
        <p className="text-sm text-destructive" role="alert">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
