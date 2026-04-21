"use client";

import { useState } from "react";
import { crearAlertaFitosanitaria } from "@/app/actions/alertas";
import { useFincaLoteOptions } from "@/hooks/use-finca-lote-options";
import type { CatalogoFitosanidadOption } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FincaRow = { id: string; nombre: string };

type Props = {
  fincas: FincaRow[];
  defaultFincaId: string | null;
  catalogo: CatalogoFitosanidadOption[];
  embedded?: boolean;
  onSuccess?: () => void;
};

const SEVERIDADES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica (marca alerta en lote)" },
] as const;

const selectClassName =
  "flex min-h-12 w-full rounded-2xl border border-border/70 bg-background/80 px-4 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

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
        <select
          id="a-finca"
          value={fincaId}
          onChange={(e) => setFincaId(e.target.value)}
          className={selectClassName}
        >
          {fincas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="a-lote">Lote</Label>
        <select
          id="a-lote"
          value={loteId}
          onChange={(e) => setLoteId(e.target.value)}
          disabled={loadingLotes || lotes.length === 0}
          className={selectClassName}
        >
          {loadingLotes ? (
            <option value="">Cargando…</option>
          ) : lotes.length === 0 ? (
            <option value="">Sin lotes</option>
          ) : (
            lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo}
              </option>
            ))
          )}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plaga">Plaga / enfermedad (catálogo, opcional)</Label>
        <select
          id="plaga"
          value={catalogoId}
          onChange={(e) => setCatalogoId(e.target.value)}
          className={selectClassName}
        >
          <option value="">— Sin seleccionar —</option>
          {catalogo.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.categoria}] {c.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="severidad">Severidad</Label>
        <select
          id="severidad"
          value={severidad}
          onChange={(e) =>
            setSeveridad(e.target.value as (typeof SEVERIDADES)[number]["value"])
          }
          className={selectClassName}
        >
          {SEVERIDADES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
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
