"use client";

import { useState } from "react";
import { crearLote } from "@/app/actions/lotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

type Props = {
  fincaId: string;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
};

const SLOPE_THRESHOLD = 12;

export function LoteCreateForm({ fincaId, onSuccess, onCancel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendientePct, setPendientePct] = useState("");

  const slopeWarning =
    pendientePct !== "" && Number(pendientePct) > SLOPE_THRESHOLD;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const densRaw = fd.get("densidad_palmas_ha");
    const pendRaw = fd.get("pendiente_pct");
    const result = await crearLote({
      finca_id: fincaId,
      codigo: String(fd.get("codigo") ?? ""),
      area_ha: fd.get("area_ha"),
      anio_siembra: fd.get("anio_siembra"),
      material_genetico: fd.get("material_genetico")
        ? String(fd.get("material_genetico"))
        : null,
      densidad_palmas_ha:
        densRaw === "" || densRaw === null ? null : densRaw,
      pendiente_pct:
        pendRaw === "" || pendRaw === null ? null : pendRaw,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSuccess?.(result.data.id);
  }

  const yearDefault = new Date().getFullYear();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="lc-codigo">Código del lote <span className="text-destructive">*</span></Label>
        <Input
          id="lc-codigo"
          name="codigo"
          required
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          placeholder="Ej. L-01"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lc-area">Área (ha) <span className="text-destructive">*</span></Label>
          <Input
            id="lc-area"
            name="area_ha"
            type="number"
            required
            min={0.0001}
            step="0.0001"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            placeholder="0.0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lc-anio">Año de siembra <span className="text-destructive">*</span></Label>
          <Input
            id="lc-anio"
            name="anio_siembra"
            type="number"
            required
            min={1900}
            max={yearDefault}
            defaultValue={yearDefault}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lc-pendiente">
          Pendiente del terreno (%)
        </Label>
        <Input
          id="lc-pendiente"
          name="pendiente_pct"
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={pendientePct}
          onChange={(e) => setPendientePct(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          placeholder="0.0"
        />
        {slopeWarning ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Alerta técnica (RN12):</strong> Pendiente &gt;{SLOPE_THRESHOLD}%. Riesgo de erosión del suelo. El lote se registrará con esta advertencia.
            </span>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lc-material">Material genético</Label>
          <Input
            id="lc-material"
            name="material_genetico"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            placeholder="Ej. DxP Bredá"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lc-densidad">Palmas / ha</Label>
          <Input
            id="lc-densidad"
            name="densidad_palmas_ha"
            type="number"
            min={1}
            step="0.01"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            placeholder="143"
          />
        </div>
      </div>
      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Guardando…" : "Registrar lote"}
        </Button>
      </div>
    </form>
  );
}

