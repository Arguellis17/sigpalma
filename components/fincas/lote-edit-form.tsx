"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarLote } from "@/app/actions/lotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  fincaId: string;
  loteId: string;
  initial: {
    codigo: string;
    area_ha: string | number;
    anio_siembra: number;
    material_genetico: string | null;
    densidad_palmas_ha: string | number | null;
  };
};

const yearMax = new Date().getFullYear();

export function LoteEditForm({ fincaId, loteId, initial }: Props) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(initial.codigo);
  const [areaHa, setAreaHa] = useState(String(initial.area_ha));
  const [anio, setAnio] = useState(String(initial.anio_siembra));
  const [material, setMaterial] = useState(initial.material_genetico ?? "");
  const [densidad, setDensidad] = useState(
    initial.densidad_palmas_ha != null ? String(initial.densidad_palmas_ha) : ""
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const densRaw = densidad.trim();
    const result = await actualizarLote({
      id: loteId,
      finca_id: fincaId,
      codigo,
      area_ha: areaHa,
      anio_siembra: anio,
      material_genetico: material.trim() || null,
      densidad_palmas_ha:
        densRaw === "" ? null : densRaw,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/fincas/${fincaId}/lotes/${loteId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="codigo">Código del lote</Label>
        <Input
          id="codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="area_ha">Área (ha)</Label>
        <Input
          id="area_ha"
          type="number"
          required
          min={0.0001}
          step="0.0001"
          value={areaHa}
          onChange={(e) => setAreaHa(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="anio_siembra">Año de siembra</Label>
        <Input
          id="anio_siembra"
          type="number"
          required
          min={1900}
          max={yearMax}
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="material_genetico">Material genético (opcional)</Label>
        <Input
          id="material_genetico"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="densidad_palmas_ha">Palmas / ha (opcional)</Label>
        <Input
          id="densidad_palmas_ha"
          type="number"
          min={1}
          step="0.01"
          value={densidad}
          onChange={(e) => setDensidad(e.target.value)}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
