"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearFinca } from "@/app/actions/fincas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NuevaFincaPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
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
    router.push(`/admin/fincas/${result.data.id}`);
    router.refresh();
  }

  return (
    <div className="fade-up-enter">
      <form
        onSubmit={onSubmit}
        className="surface-panel mx-auto flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre de la finca</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            minLength={1}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ubicacion">Ubicación (municipio / departamento)</Label>
          <Textarea
            id="ubicacion"
            name="ubicacion"
            rows={2}
            className="min-h-[90px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="propietario">Propietario</Label>
            <Input
              id="propietario"
              name="propietario"
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/fincas")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Crear finca"}
          </Button>
        </div>
      </form>
    </div>
  );
}
