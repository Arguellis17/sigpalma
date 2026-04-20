"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarAnalisisSuelo } from "@/app/actions/suelo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Finca = { id: string; nombre: string };
type Lote = { id: string; codigo: string };

type Props = {
  fincas: Finca[];
  lotesPorFinca: Record<string, Lote[]>;
};

export function AnalisisSueloForm({ fincas, lotesPorFinca }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fincaId, setFincaId] = useState(fincas[0]?.id ?? "");

  const lotes = fincaId ? (lotesPorFinca[fincaId] ?? []) : [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);

    const phRaw = fd.get("ph");
    const humedadRaw = fd.get("humedad_pct");
    const compactacionRaw = fd.get("compactacion");

    const result = await registrarAnalisisSuelo({
      finca_id: fd.get("finca_id"),
      lote_id: fd.get("lote_id"),
      fecha_analisis: fd.get("fecha_analisis"),
      ph: phRaw ? Number(phRaw) : null,
      humedad_pct: humedadRaw ? Number(humedadRaw) : null,
      compactacion: compactacionRaw ? Number(compactacionRaw) : null,
      notas: fd.get("notas") || null,
    });

    setPending(false);

    if (!result.success) {
      setError(result.error);
    } else {
      router.push("/tecnico/suelo");
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="surface-panel mx-auto flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="finca_id">Finca *</Label>
          <select
            id="finca_id"
            name="finca_id"
            required
            value={fincaId}
            onChange={(e) => setFincaId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Seleccione una finca…</option>
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lote_id">Lote *</Label>
          <select
            id="lote_id"
            name="lote_id"
            required
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Seleccione un lote…</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                Lote {l.codigo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fecha_analisis">Fecha del análisis *</Label>
        <Input
          id="fecha_analisis"
          name="fecha_analisis"
          type="date"
          required
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Valores de análisis (complete al menos uno)
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ph">pH del suelo</Label>
          <Input
            id="ph"
            name="ph"
            type="number"
            step="0.01"
            min={0}
            max={14}
            placeholder="Ej. 5.5"
            className="rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="humedad_pct">Humedad (%)</Label>
          <Input
            id="humedad_pct"
            name="humedad_pct"
            type="number"
            step="0.1"
            min={0}
            max={100}
            placeholder="Ej. 45"
            className="rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compactacion">Compactación (MPa)</Label>
          <Input
            id="compactacion"
            name="compactacion"
            type="number"
            step="0.01"
            min={0}
            placeholder="Ej. 2.5"
            className="rounded-xl"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas adicionales</Label>
        <Textarea
          id="notas"
          name="notas"
          rows={3}
          placeholder="Observaciones del análisis, condiciones del suelo, recomendaciones…"
          className="rounded-xl"
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/tecnico/suelo")}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar análisis"}
        </Button>
      </div>
    </form>
  );
}
