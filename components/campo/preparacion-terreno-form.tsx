"use client";

import { useEffect, useState } from "react";
import type { PreparacionTerrenoPendienteRow } from "@/app/actions/queries";
import {
  ACTIVIDADES_PREPARACION_TERRENO,
  ACTIVIDAD_PREPARACION_LABEL,
  PENDIENTE_TERRENO_MAX_PCT,
  mensajePendienteCritica,
  pendienteRequiereValidacionTecnico,
} from "@/lib/preparacion-terreno";
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

export type PreparacionConfirmSnapshot = {
  selected: PreparacionTerrenoPendienteRow;
  pendiente: string;
  actividades: string[];
  notas: string;
};

type Props = {
  pendientes: PreparacionTerrenoPendienteRow[];
  embedded?: boolean;
  onRequestConfirm: (snapshot: PreparacionConfirmSnapshot) => void;
};

export function PreparacionTerrenoForm({
  pendientes,
  embedded = false,
  onRequestConfirm,
}: Props) {
  const [loteKey, setLoteKey] = useState(pendientes[0]?.lote_id ?? "");
  const [pendiente, setPendiente] = useState("");
  const [actividades, setActividades] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const selected = pendientes.find((p) => p.lote_id === loteKey);
  const pendienteNum = Number(pendiente.replace(",", "."));
  const pendienteAlerta =
    Number.isFinite(pendienteNum) && pendienteRequiereValidacionTecnico(pendienteNum)
      ? mensajePendienteCritica(pendienteNum)
      : null;

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6";

  useEffect(() => {
    if (!pendientes.length) return;
    if (!pendientes.some((p) => p.lote_id === loteKey)) {
      setLoteKey(pendientes[0].lote_id);
    }
  }, [pendientes, loteKey]);

  useEffect(() => {
    if (!selected) return;
    if (pendiente === "" && selected.pendiente_lote_pct != null) {
      setPendiente(String(selected.pendiente_lote_pct));
    }
  }, [selected, pendiente]);

  function toggleActividad(id: string) {
    setActividades((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function validate(): string | null {
    if (!selected) return "Seleccione un lote pendiente.";
    if (actividades.length === 0) {
      return "Seleccione al menos una actividad realizada (RN54).";
    }
    if (!Number.isFinite(pendienteNum) || pendienteNum < 0) {
      return "Indique la pendiente final del terreno.";
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
      pendiente,
      actividades,
      notas,
    });
  }

  return (
    <form onSubmit={onRequestSubmit} className={formClass}>
      <div className="space-y-2">
        <Label htmlFor="lote">Lote planificado</Label>
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
                {p.lote_codigo} · siembra {p.fecha_proyectada}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium">{selected.material_nombre}</p>
          <p className="text-muted-foreground">
            Fecha proyectada de siembra: {selected.fecha_proyectada}
          </p>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Actividades realizadas</legend>
        {ACTIVIDADES_PREPARACION_TERRENO.map((id) => (
          <label
            key={id}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-2"
          >
            <input
              type="checkbox"
              className="size-5 rounded border-border accent-primary"
              checked={actividades.includes(id)}
              onChange={() => toggleActividad(id)}
            />
            <span>{ACTIVIDAD_PREPARACION_LABEL[id]}</span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="pendiente">Pendiente final del terreno (%)</Label>
        <Input
          id="pendiente"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          step="0.01"
          value={pendiente}
          onChange={(e) => setPendiente(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base"
          required
        />
        <p className="text-xs text-muted-foreground">
          Debe ser menor al {PENDIENTE_TERRENO_MAX_PCT}% para habilitar siembra
          automáticamente (RN53).
        </p>
      </div>

      {pendienteAlerta ? (
        <p
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="status"
        >
          {pendienteAlerta}
        </p>
      ) : null}

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
        Revisar y registrar
      </Button>
    </form>
  );
}

export { ACTIVIDAD_PREPARACION_LABEL };
