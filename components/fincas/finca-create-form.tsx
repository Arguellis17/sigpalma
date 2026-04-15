"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearFinca } from "@/app/actions/fincas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FincaCreateForm() {
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
    router.push(`/fincas/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre de la finca</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          minLength={1}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          autoComplete="organization"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ubicacion">Ubicación (municipio / departamento)</Label>
        <Textarea
          id="ubicacion"
          name="ubicacion"
          rows={2}
          className="min-h-[110px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="area_ha">Área total (ha)</Label>
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
        <Label htmlFor="propietario">Propietario (opcional)</Label>
        <Input
          id="propietario"
          name="propietario"
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Registrar finca"}
      </Button>
    </form>
  );
}
