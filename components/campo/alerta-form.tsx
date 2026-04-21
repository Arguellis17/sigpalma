"use client";

import { useState } from "react";
import { crearAlertaFitosanitaria } from "@/app/actions/alertas";
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!fincaId || !loteId) {
      setError("Seleccione finca y lote.");
      return;
    }
    setPending(true);
    const res = await crearAlertaFitosanitaria({
      finca_id: fincaId,
      lote_id: loteId,
      catalogo_item_id: catalogoId || null,
      severidad,
      descripcion: descripcion.trim() || null,
      source: "web",
    });
    setPending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDescripcion("");
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
