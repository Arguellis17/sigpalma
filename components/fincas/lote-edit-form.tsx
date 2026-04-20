"use client";

import { useState } from "react";
import { actualizarLote } from "@/app/actions/lotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

type Props = {
  fincaId: string;
  loteId: string;
  initial: {
    codigo: string;
    area_ha: string | number;
    anio_siembra: number;
    material_genetico: string | null;
    densidad_palmas_ha: string | number | null;
    pendiente_pct?: string | number | null;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
};

const SLOPE_THRESHOLD = 12;
const yearMax = new Date().getFullYear();

export function LoteEditForm({ fincaId, loteId, initial, onSuccess, onCancel }: Props) {
  const [codigo, setCodigo] = useState(initial.codigo);
  const [areaHa, setAreaHa] = useState(String(initial.area_ha));
  const [anio, setAnio] = useState(String(initial.anio_siembra));
  const [material, setMaterial] = useState(initial.material_genetico ?? "");
  const [densidad, setDensidad] = useState(
    initial.densidad_palmas_ha != null ? String(initial.densidad_palmas_ha) : ""
  );
  const [pendientePct, setPendientePct] = useState(
    initial.pendiente_pct != null ? String(initial.pendiente_pct) : ""
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slopeWarning = pendientePct !== "" && Number(pendientePct) > SLOPE_THRESHOLD;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const densRaw = densidad.trim();
    const pendRaw = pendientePct.trim();
    const result = await actualizarLote({
      id: loteId,
      finca_id: fincaId,
      codigo,
      area_ha: areaHa,
      anio_siembra: anio,
      material_genetico: material.trim() || null,
      densidad_palmas_ha: densRaw === "" ? null : densRaw,
      pendiente_pct: pendRaw === "" ? null : pendRaw,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="le-codigo">Código del lote <span className="text-destructive">*</span></Label>
        <Input
          id="le-codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="le-area">Área (ha) <span className="text-destructive">*</span></Label>
          <Input
            id="le-area"
            type="number"
            required
            min={0.0001}
            step="0.0001"
            value={areaHa}
            onChange={(e) => setAreaHa(e.target.value)}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="le-anio">Año de siembra <span className="text-destructive">*</span></Label>
          <Input
            id="le-anio"
            type="number"
            required
            min={1900}
            max={yearMax}
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="le-pendiente">Pendiente del terreno (%)</Label>
        <Input
          id="le-pendiente"
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
              <strong>Alerta técnica (RN12):</strong> Pendiente &gt;{SLOPE_THRESHOLD}%. Riesgo de erosión del suelo.
            </span>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="le-material">Material genético</Label>
          <Input
            id="le-material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="le-densidad">Palmas / ha</Label>
          <Input
            id="le-densidad"
            type="number"
            min={1}
            step="0.01"
            value={densidad}
            onChange={(e) => setDensidad(e.target.value)}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
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
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

