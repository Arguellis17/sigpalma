"use client";

import { useEffect, useState } from "react";
import {
  actualizarAnalisisSueloDesdeFormulario,
  registrarAnalisisSueloDesdeFormulario,
} from "@/app/actions/suelo";
import { Button } from "@/components/ui/button";
import { DatePickerField, todayLocalYmd } from "@/components/ui/date-picker-field";
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
import { PdfLaboratorioDropzone } from "@/components/suelo/pdf-laboratorio-dropzone";

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
  /** Path en Storage (bucket evidencia-tecnica), no URL pública. */
  archivo_url?: string | null;
};

const SELECT_NONE = "__none__";
const LOTE_SELECT_IDLE = "__lote_idle__";

type Props = {
  fincas: Finca[];
  lotesPorFinca: Record<string, Lote[]>;
  /** Full-page shell vs compact dialog body */
  layout?: "page" | "dialog";
  /** When set, form runs in edit mode (multipart + PDF opcional). */
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
  const [fechaAnalisis, setFechaAnalisis] = useState(() =>
    record?.fecha_analisis ? record.fecha_analisis.slice(0, 10) : todayLocalYmd()
  );

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

  useEffect(() => {
    setFechaAnalisis(
      record?.fecha_analisis ? record.fecha_analisis.slice(0, 10) : todayLocalYmd()
    );
  }, [record?.id, record?.fecha_analisis]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);

    const result =
      isEdit && record
        ? await actualizarAnalisisSueloDesdeFormulario(fd)
        : await registrarAnalisisSueloDesdeFormulario(fd);

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
    <form onSubmit={handleSubmit} className={shellClass} encType="multipart/form-data">
      {isEdit && record ? (
        <input type="hidden" name="id" value={record.id} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="finca_id">Finca *</Label>
          <input type="hidden" name="finca_id" value={fincaId} required />
          <Select
            value={fincas.some((f) => f.id === fincaId) ? fincaId : SELECT_NONE}
            onValueChange={(v) => setFincaId(v === SELECT_NONE ? "" : v)}
          >
            <SelectTrigger id="finca_id" className="rounded-lg text-sm shadow-none">
              <SelectValue placeholder="Seleccione una finca…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_NONE} disabled className="opacity-60">
                {fincas.length === 0 ? "Sin fincas" : "Seleccione una finca…"}
              </SelectItem>
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
          <Select
            value={
              lotes.length > 0 && lotes.some((l) => l.id === loteId)
                ? loteId
                : LOTE_SELECT_IDLE
            }
            onValueChange={(v) => {
              if (v !== LOTE_SELECT_IDLE) setLoteId(v);
            }}
          >
            <SelectTrigger id="lote_id" className="rounded-lg text-sm shadow-none">
              <SelectValue placeholder="Seleccione un lote…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOTE_SELECT_IDLE} disabled className="opacity-60">
                {lotes.length === 0 ? "Sin lotes" : "Seleccione un lote…"}
              </SelectItem>
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
        <input type="hidden" name="fecha_analisis" value={fechaAnalisis} required />
        <DatePickerField
          id="fecha_analisis"
          value={fechaAnalisis}
          onChange={setFechaAnalisis}
          placeholder="Elegir fecha del análisis…"
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

      <PdfLaboratorioDropzone
        hasExistingFile={Boolean(isEdit && record?.archivo_url)}
        disabled={pending}
        compact={layout === "dialog"}
      />

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
