"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearLote } from "@/app/actions/lotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  fincaId: string;
};

export function LoteCreateForm({ fincaId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const densRaw = fd.get("densidad_palmas_ha");
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
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/fincas/${fincaId}`);
    router.refresh();
  }

  const yearDefault = new Date().getFullYear();

  return (
    <form onSubmit={onSubmit} className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="codigo">Código del lote</Label>
        <Input
          id="codigo"
          name="codigo"
          required
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          placeholder="Ej. L-01"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="area_ha">Área (ha)</Label>
        <Input
          id="area_ha"
          name="area_ha"
          type="number"
          required
          min={0.0001}
          step="0.0001"
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="anio_siembra">Año de siembra</Label>
        <Input
          id="anio_siembra"
          name="anio_siembra"
          type="number"
          required
          min={1900}
          max={yearDefault}
          defaultValue={yearDefault}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="material_genetico">Material genético (opcional)</Label>
        <Input
          id="material_genetico"
          name="material_genetico"
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="densidad_palmas_ha">Palmas / ha (opcional)</Label>
        <Input
          id="densidad_palmas_ha"
          name="densidad_palmas_ha"
          type="number"
          min={1}
          step="0.01"
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Registrar lote"}
      </Button>
    </form>
  );
}
