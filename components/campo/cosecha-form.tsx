"use client";

import { useState } from "react";
import { reportarCosecha } from "@/app/actions/cosecha";
import { useFincaLoteOptions } from "@/hooks/use-finca-lote-options";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
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
  embedded?: boolean;
  onSuccess?: () => void;
};

export function CosechaForm({
  fincas,
  defaultFincaId,
  embedded = false,
  onSuccess,
}: Props) {
  const { fincaId, setFincaId, loteId, setLoteId, lotes, loadingLotes } =
    useFincaLoteOptions(fincas, defaultFincaId);

  const [fecha, setFecha] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [pesoKg, setPesoKg] = useState("");
  const [conteo, setConteo] = useState("");
  const [minFrutos, setMinFrutos] = useState("");
  const [maxFrutos, setMaxFrutos] = useState("");
  const [obs, setObs] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    id: string;
    rendimiento: number;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultado(null);
    if (!fincaId || !loteId) {
      setError("Seleccione finca y lote.");
      return;
    }
    setPending(true);
    const res = await reportarCosecha({
      finca_id: fincaId,
      lote_id: loteId,
      fecha,
      peso_kg: Number(pesoKg),
      conteo_racimos: Number(conteo),
      madurez_frutos_caidos_min:
        minFrutos === "" ? null : Number.parseInt(minFrutos, 10),
      madurez_frutos_caidos_max:
        maxFrutos === "" ? null : Number.parseInt(maxFrutos, 10),
      observaciones_calidad: obs.trim() || null,
      source: "web",
    });
    setPending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setPesoKg("");
    setConteo("");
    setObs("");
    if (onSuccess) {
      onSuccess();
      return;
    }
    setResultado({
      id: res.data.id,
      rendimiento: res.data.rendimiento_ton_ha,
    });
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
        <Label htmlFor="c-finca">Finca</Label>
        <Select value={fincaId} onValueChange={setFincaId}>
          <SelectTrigger id="c-finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
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
        <Label htmlFor="c-lote">Lote</Label>
        <Select
          value={loadingLotes || lotes.length === 0 || !loteId ? undefined : loteId}
          onValueChange={setLoteId}
          disabled={loadingLotes || lotes.length === 0}
        >
          <SelectTrigger id="c-lote" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue
              placeholder={
                loadingLotes ? "Cargando…" : lotes.length === 0 ? "Sin lotes" : "Lote"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {lotes.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.codigo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-fecha">Fecha de cosecha</Label>
        <DatePickerField
          id="c-fecha"
          value={fecha}
          onChange={setFecha}
          placeholder="Elegir fecha de cosecha…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="peso">Peso total (kg)</Label>
        <Input
          id="peso"
          type="number"
          inputMode="decimal"
          min={0.001}
          step="0.001"
          value={pesoKg}
          onChange={(e) => setPesoKg(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="racimos">Conteo de racimos</Label>
        <Input
          id="racimos"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={conteo}
          onChange={(e) => setConteo(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="minf">Frutos caídos min (opc.)</Label>
          <Input
            id="minf"
            type="number"
            min={0}
            max={20}
            value={minFrutos}
            onChange={(e) => setMinFrutos(e.target.value)}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxf">Frutos caídos max (opc.)</Label>
          <Input
            id="maxf"
            type="number"
            min={0}
            max={20}
            value={maxFrutos}
            onChange={(e) => setMaxFrutos(e.target.value)}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="obs">Observaciones de calidad (opc.)</Label>
        <Textarea
          id="obs"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={2}
          className="min-h-[100px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
        />
      </div>
      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {resultado ? (
        <p className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900">
          Cosecha registrada. Rendimiento aproximado:{" "}
          <strong>
            {resultado.rendimiento.toLocaleString("es-CO", {
              maximumFractionDigits: 3,
            })}{" "}
            t/ha
          </strong>
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Registrar cosecha RFF"}
      </Button>
    </form>
  );
}
