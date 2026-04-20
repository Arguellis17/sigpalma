"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearFinca } from "@/app/actions/fincas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
};

export function FincaCreateForm({ onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    const result = await crearFinca({
      nombre: String(fd.get("nombre") ?? ""),
      ubicacion: fd.get("ubicacion") ? String(fd.get("ubicacion")) : null,
      area_ha: fd.get("area_ha"),
      propietario: fd.get("propietario") ? String(fd.get("propietario")) : null,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (onSuccess) {
      onSuccess(result.data.id);
    } else {
      router.push(`/admin/fincas/${result.data.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="fc-nombre">Nombre de la finca <span className="text-destructive">*</span></Label>
        <Input
          id="fc-nombre"
          name="nombre"
          required
          minLength={1}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          placeholder="Ej. Hacienda La Esperanza"
          autoComplete="organization"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fc-ubicacion">Ubicación (municipio / departamento)</Label>
        <Textarea
          id="fc-ubicacion"
          name="ubicacion"
          rows={2}
          className="min-h-[90px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
          placeholder="Ej. Tibú, Norte de Santander"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fc-area">Área total (ha) <span className="text-destructive">*</span></Label>
          <Input
            id="fc-area"
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
          <Label htmlFor="fc-propietario">Propietario</Label>
          <Input
            id="fc-propietario"
            name="propietario"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            placeholder="Nombre del propietario"
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
          {pending ? "Guardando…" : "Crear finca"}
        </Button>
      </div>
    </form>
  );
}
