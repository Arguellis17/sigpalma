"use client";

import { useEffect, useRef, useState } from "react";
import {
  crearAlertaFitosanitaria,
  subirEvidenciaAlertaFitosanitaria,
} from "@/app/actions/alertas";
import { useFincaLoteOptions } from "@/hooks/use-finca-lote-options";
import type { CatalogoFitosanidadOption } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Camera, ImageIcon, X } from "lucide-react";

type FincaRow = { id: string; nombre: string };

type Props = {
  fincas: FincaRow[];
  defaultFincaId: string | null;
  catalogo: CatalogoFitosanidadOption[];
  embedded?: boolean;
  onSuccess?: () => void;
};

const LOTE_SELECT_IDLE = "__lote_idle__";

const SEVERIDADES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica (marca alerta en lote)" },
] as const;

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp";

export function AlertaForm({
  fincas,
  defaultFincaId,
  catalogo,
  embedded = false,
  onSuccess,
}: Props) {
  const { fincaId, setFincaId, loteId, setLoteId, lotes, loadingLotes } =
    useFincaLoteOptions(fincas, defaultFincaId);

  const [catalogoId, setCatalogoId] = useState<string>("");
  const [severidad, setSeveridad] =
    useState<(typeof SEVERIDADES)[number]["value"]>("media");
  const [descripcion, setDescripcion] = useState("");
  const [evidenciaPaths, setEvidenciaPaths] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const inputCameraRef = useRef<HTMLInputElement>(null);
  const inputGalleryRef = useRef<HTMLInputElement>(null);
  const evidenciaPathsRef = useRef<string[]>([]);

  useEffect(() => {
    evidenciaPathsRef.current = evidenciaPaths;
  }, [evidenciaPaths]);

  async function uploadFiles(files: FileList | File[] | null) {
    if (!files?.length || !fincaId) return;
    const list = Array.from(files);
    setError(null);
    for (const file of list) {
      if (evidenciaPathsRef.current.length >= 8) {
        setError("Máximo 8 fotos por alerta.");
        break;
      }
      const fd = new FormData();
      fd.set("finca_id", fincaId);
      fd.set("archivo", file);
      const up = await subirEvidenciaAlertaFitosanitaria(fd);
      if (!up.success) {
        setError(up.error);
        return;
      }
      setEvidenciaPaths((prev) => {
        const next = [...prev, up.data.path];
        evidenciaPathsRef.current = next;
        return next;
      });
    }
    if (inputCameraRef.current) inputCameraRef.current.value = "";
    if (inputGalleryRef.current) inputGalleryRef.current.value = "";
  }

  function removeEvidencia(idx: number) {
    setEvidenciaPaths((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      evidenciaPathsRef.current = next;
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!fincaId || !loteId) {
      setError("Seleccione finca y lote.");
      return;
    }
    if (evidenciaPaths.length === 0) {
      setError("Adjunte al menos una foto de evidencia (cámara o galería / archivo).");
      return;
    }
    setPending(true);
    const res = await crearAlertaFitosanitaria({
      finca_id: fincaId,
      lote_id: loteId,
      catalogo_item_id: catalogoId || null,
      severidad,
      descripcion: descripcion.trim() || null,
      evidencia_urls: evidenciaPaths,
      source: "web",
    });
    setPending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDescripcion("");
    setEvidenciaPaths([]);
    evidenciaPathsRef.current = [];
    if (onSuccess) {
      onSuccess();
      return;
    }
    setMessage(
      res.data.lote_estado_alerta
        ? "Alerta crítica registrada: el lote queda marcado para seguimiento."
        : "Alerta fitosanitaria registrada."
    );
  }

  if (fincas.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        No hay fincas visibles para su cuenta. Verifique su asignación con un
        administrador.
      </p>
    );
  }

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6";

  return (
    <form onSubmit={onSubmit} className={formClass}>
      <div className="space-y-2">
        <Label htmlFor="a-finca">Finca</Label>
        <Select value={fincaId} onValueChange={setFincaId}>
          <SelectTrigger id="a-finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue placeholder="Finca" />
          </SelectTrigger>
          <SelectContent>
            {fincas.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="a-lote">Lote</Label>
        <Select
          value={
            !loadingLotes && lotes.length > 0 && lotes.some((l) => l.id === loteId)
              ? loteId
              : LOTE_SELECT_IDLE
          }
          onValueChange={(v) => {
            if (v !== LOTE_SELECT_IDLE) setLoteId(v);
          }}
          disabled={loadingLotes || lotes.length === 0}
        >
          <SelectTrigger id="a-lote" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue
              placeholder={
                loadingLotes ? "Cargando…" : lotes.length === 0 ? "Sin lotes" : "Lote"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={LOTE_SELECT_IDLE} disabled className="opacity-60">
              {loadingLotes
                ? "Cargando…"
                : lotes.length === 0
                  ? "Sin lotes"
                  : "Seleccione un lote…"}
            </SelectItem>
            {lotes.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.codigo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plaga">Plaga / enfermedad (catálogo, opcional)</Label>
        <Select
          value={catalogoId || "__none__"}
          onValueChange={(v) => setCatalogoId(v === "__none__" ? "" : v)}
        >
          <SelectTrigger id="plaga" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue placeholder="— Sin seleccionar —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Sin seleccionar —</SelectItem>
            {catalogo.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                [{c.categoria}] {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="severidad">Severidad</Label>
        <Select
          value={severidad}
          onValueChange={(v) =>
            setSeveridad(v as (typeof SEVERIDADES)[number]["value"])
          }
        >
          <SelectTrigger id="severidad" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERIDADES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="desc">Descripción (opcional)</Label>
        <Textarea
          id="desc"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          className="min-h-[110px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-base">Evidencia fotográfica (obligatoria)</Label>
          <span className="text-xs text-muted-foreground">
            {evidenciaPaths.length} / 8
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          En el teléfono puede usar la cámara; en la computadora, adjunte archivos de imagen.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            disabled={!fincaId || evidenciaPaths.length >= 8 || pending}
            onClick={() => inputCameraRef.current?.click()}
          >
            <Camera className="size-4" />
            Tomar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            disabled={!fincaId || evidenciaPaths.length >= 8 || pending}
            onClick={() => inputGalleryRef.current?.click()}
          >
            <ImageIcon className="size-4" />
            Galería o archivo
          </Button>
        </div>
        <input
          ref={inputCameraRef}
          type="file"
          accept={ACCEPT_IMAGES}
          capture="environment"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => void uploadFiles(e.target.files)}
        />
        <input
          ref={inputGalleryRef}
          type="file"
          accept={ACCEPT_IMAGES}
          multiple
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => void uploadFiles(e.target.files)}
        />
        {evidenciaPaths.length > 0 ? (
          <ul className="flex flex-col gap-2 text-sm">
            {evidenciaPaths.map((path, idx) => (
              <li
                key={`${path}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2"
              >
                <span className="truncate font-mono text-xs text-muted-foreground" title={path}>
                  {path.split("/").pop()}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => removeEvidencia(idx)}
                  aria-label="Quitar foto"
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto" disabled={pending}>
        {pending ? "Enviando…" : "Registrar alerta"}
      </Button>
    </form>
  );
}
