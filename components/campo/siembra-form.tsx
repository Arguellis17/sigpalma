"use client";

import { useEffect, useState } from "react";
import type { SiembraPendienteRow } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { DatePickerField, todayLocalYmd } from "@/components/ui/date-picker-field";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type SiembraConfirmSnapshot = {
  selected: SiembraPendienteRow;
  fecha: string;
  cantidad: string;
  notas: string;
};

type Props = {
  pendientes: SiembraPendienteRow[];
  embedded?: boolean;
  onRequestConfirm: (snapshot: SiembraConfirmSnapshot) => void;
};

export function SiembraForm({
  pendientes,
  embedded = false,
  onRequestConfirm,
}: Props) {
  const [loteKey, setLoteKey] = useState(pendientes[0]?.lote_id ?? "");
  const [fecha, setFecha] = useState(() => todayLocalYmd());
  const [cantidad, setCantidad] = useState("");
  const [profundidad, setProfundidad] = useState(false);
  const [orientacion, setOrientacion] = useState(false);
  const [notas, setNotas] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const selected = pendientes.find((p) => p.lote_id === loteKey);
  const qty = Number(cantidad.replace(",", "."));

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6";

  useEffect(() => {
    if (!pendientes.length) return;
    if (!pendientes.some((p) => p.lote_id === loteKey)) {
      setLoteKey(pendientes[0].lote_id);
    }
  }, [pendientes, loteKey]);

  function validate(): string | null {
    if (!selected) return "Seleccione un lote listo para siembra.";
    if (!profundidad || !orientacion) {
      return "Confirme profundidad y orientación de plúmula/radícula.";
    }
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return "Indique un número entero de palmas sembradas.";
    }
    if (selected.max_palmas != null && qty > selected.max_palmas) {
      return `La cantidad supera el máximo permitido (${selected.max_palmas} palmas).`;
    }
    return null;
  }

  function onRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    if (!selected) return;
    onRequestConfirm({
      selected,
      fecha,
      cantidad,
      notas,
    });
  }

  return (
    <form onSubmit={onRequestSubmit} className={formClass}>
      <div className="space-y-2">
        <Label htmlFor="lote">Lote</Label>
        <Select value={loteKey} onValueChange={setLoteKey}>
          <SelectTrigger
            id="lote"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base"
          >
            <SelectValue placeholder="Seleccione lote…" />
          </SelectTrigger>
          <SelectContent>
            {pendientes.map((p) => (
              <SelectItem key={p.lote_id} value={p.lote_id}>
                {p.lote_codigo} · {p.material_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Material genético: {selected.material_nombre}</p>
          <p className="text-muted-foreground">
            Plan siembra {selected.fecha_proyectada} · {selected.area_ha} ha
            {selected.max_palmas != null ? ` · máx. ${selected.max_palmas} palmas` : ""}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha de siembra</Label>
          <DatePickerField id="fecha" value={fecha} onChange={setFecha} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cantidad">Palmas sembradas</Label>
          <NumericInput
            id="cantidad"
            integer
            value={cantidad}
            onValueChange={setCantidad}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base"
            required
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Confirmaciones técnicas</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-2">
          <input
            type="checkbox"
            className="size-5 rounded border-border accent-primary"
            checked={profundidad}
            onChange={(e) => setProfundidad(e.target.checked)}
          />
          <span>Profundidad de siembra conforme a estándar técnico</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-2">
          <input
            type="checkbox"
            className="size-5 rounded border-border accent-primary"
            checked={orientacion}
            onChange={(e) => setOrientacion(e.target.checked)}
          />
          <span>Orientación correcta de plúmula y radícula</span>
        </label>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notas">Observaciones (opcional)</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className="rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base"
        />
      </div>

      {err ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="min-h-12 rounded-2xl">
        Revisar y registrar siembra
      </Button>
    </form>
  );
}
