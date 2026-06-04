"use client";

import { useState } from "react";
import { crearLote } from "@/app/actions/lotes";
import { LoteEstadoFields } from "@/components/fincas/lote-estado-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import type { LoteEstadoCultivo } from "@/lib/lote-estado";

type Props = {
  fincaId: string;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
};

const SLOPE_THRESHOLD = 12;

export function LoteCreateForm({ fincaId, onSuccess, onCancel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaHa, setAreaHa] = useState("");
  const [anioSiembra, setAnioSiembra] = useState(String(new Date().getFullYear()));
  const [densidad, setDensidad] = useState("");
  const [pendientePct, setPendientePct] = useState("");
  const [estadoCultivo, setEstadoCultivo] = useState<LoteEstadoCultivo>("disponible");
  const [activo, setActivo] = useState(true);

  const slopeWarning =
    pendientePct !== "" && Number(pendientePct) > SLOPE_THRESHOLD;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const result = await crearLote({
      finca_id: fincaId,
      codigo: String(fd.get("codigo") ?? ""),
      area_ha: areaHa,
      anio_siembra: anioSiembra,
      material_genetico: fd.get("material_genetico")
        ? String(fd.get("material_genetico"))
        : null,
      densidad_palmas_ha: densidad.trim() === "" ? null : densidad,
      pendiente_pct: pendientePct.trim() === "" ? null : pendientePct,
      estado_cultivo: estadoCultivo,
      activo,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSuccess?.(result.data.id);
  }

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
          <NumericInput
            id="lc-area"
            value={areaHa}
            onValueChange={setAreaHa}
            required
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            placeholder="0.0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lc-anio">Año de siembra <span className="text-destructive">*</span></Label>
          <NumericInput
            id="lc-anio"
            integer
            value={anioSiembra}
            onValueChange={setAnioSiembra}
            required
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>
      </div>
      <LoteEstadoFields
        idPrefix="lc"
        estadoCultivo={estadoCultivo}
        onEstadoCultivoChange={setEstadoCultivo}
        activo={activo}
        onActivoChange={setActivo}
      />
      <div className="space-y-1.5">
        <Label htmlFor="lc-pendiente">
          Pendiente del terreno (%)
        </Label>
        <NumericInput
          id="lc-pendiente"
          value={pendientePct}
          onValueChange={setPendientePct}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          placeholder="0.0"
        />
        {slopeWarning ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Alerta técnica:</strong> Pendiente &gt;{SLOPE_THRESHOLD}%. Riesgo de erosión del suelo. El lote se registrará con esta advertencia.
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
          <NumericInput
            id="lc-densidad"
            value={densidad}
            onValueChange={setDensidad}
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
