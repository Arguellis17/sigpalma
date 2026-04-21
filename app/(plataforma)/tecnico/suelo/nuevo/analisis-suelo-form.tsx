"use client";

import { useEffect, useState } from "react";
import {
  actualizarAnalisisSuelo,
  registrarAnalisisSuelo,
} from "@/app/actions/suelo";
import { Button } from "@/components/ui/button";
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

type Finca = { id: string; nombre: string };
type Lote = { id: string; codigo: string };

export type AnalisisSueloFormRecord = {
  id: string;
  finca_id: string;
  lote_id: string;
  fecha_analisis: string;
  ph: number | null;
  humedad_pct: number | null;
  compactacion: number | null;
  notas: string | null;
};

type Props = {
  fincas: Finca[];
  lotesPorFinca: Record<string, Lote[]>;
  /** Full-page shell vs compact dialog body */
  layout?: "page" | "dialog";
  /** When set, form runs in edit mode and calls `actualizarAnalisisSuelo`. */
  record?: AnalisisSueloFormRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
};

export function AnalisisSueloForm({
  fincas,
  lotesPorFinca,
  layout = "page",
  record = null,
  onSuccess,
  onCancel,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fincaId, setFincaId] = useState(record?.finca_id ?? fincas[0]?.id ?? "");
  const [loteId, setLoteId] = useState(record?.lote_id ?? "");

  const lotes = fincaId ? (lotesPorFinca[fincaId] ?? []) : [];
  const isEdit = Boolean(record);

  useEffect(() => {
    setLoteId((prev) => {
      const list = fincaId ? (lotesPorFinca[fincaId] ?? []) : [];
      if (list.some((l) => l.id === prev)) return prev;
      if (
        record &&
        fincaId === record.finca_id &&
        list.some((l) => l.id === record.lote_id)
      ) {
        return record.lote_id;
      }
      return "";
    });
  }, [fincaId, lotesPorFinca, record]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);

    const phRaw = fd.get("ph");
    const humedadRaw = fd.get("humedad_pct");
    const compactacionRaw = fd.get("compactacion");

    const payload = {
      finca_id: fd.get("finca_id"),
      lote_id: fd.get("lote_id"),
      fecha_analisis: fd.get("fecha_analisis"),
      ph: phRaw ? Number(phRaw) : null,
      humedad_pct: humedadRaw ? Number(humedadRaw) : null,
      compactacion: compactacionRaw ? Number(compactacionRaw) : null,
      notas: fd.get("notas") || null,
    };

    const result = isEdit && record
      ? await actualizarAnalisisSuelo({ id: record.id, ...payload })
      : await registrarAnalisisSuelo(payload);

    setPending(false);

    if (!result.success) {
      setError(result.error);
    } else {
      onSuccess();
    }
  }

  const shellClass =
    layout === "page"
      ? "surface-panel mx-auto flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6"
      : "flex flex-col gap-4";

  return (
    <form onSubmit={handleSubmit} className={shellClass}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="finca_id">Finca *</Label>
          <input type="hidden" name="finca_id" value={fincaId} required />
          <Select value={fincaId || undefined} onValueChange={setFincaId}>
            <SelectTrigger id="finca_id" className="rounded-lg text-sm shadow-none">
              <SelectValue placeholder="Seleccione una finca…" />
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

        <div className="space-y-1.5">
          <Label htmlFor="lote_id">Lote *</Label>
          <input type="hidden" name="lote_id" value={loteId} required />
          <Select value={loteId || undefined} onValueChange={setLoteId}>
            <SelectTrigger id="lote_id" className="rounded-lg text-sm shadow-none">
              <SelectValue placeholder="Seleccione un lote…" />
            </SelectTrigger>
            <SelectContent>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  Lote {l.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fecha_analisis">Fecha del análisis *</Label>
        <Input
          id="fecha_analisis"
          name="fecha_analisis"
          type="date"
          required
          defaultValue={
            record?.fecha_analisis
              ? record.fecha_analisis.slice(0, 10)
              : new Date().toISOString().split("T")[0]
          }
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
            defaultValue={record?.ph != null ? String(record.ph) : undefined}
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
            defaultValue={record?.humedad_pct != null ? String(record.humedad_pct) : undefined}
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
            defaultValue={record?.compactacion != null ? String(record.compactacion) : undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas adicionales</Label>
        <Textarea
          id="notas"
          name="notas"
          rows={layout === "dialog" ? 2 : 3}
          placeholder="Observaciones del análisis, condiciones del suelo, recomendaciones…"
          className="rounded-xl"
          defaultValue={record?.notas ?? undefined}
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Guardando…"
            : isEdit
              ? "Guardar cambios"
              : "Registrar análisis"}
        </Button>
      </div>
    </form>
  );
}
