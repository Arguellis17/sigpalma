"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarFinca } from "@/app/actions/fincas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  fincaId: string;
  initial: {
    nombre: string;
    ubicacion: string | null;
    area_ha: string | number;
    propietario: string | null;
  };
};

export function FincaEditForm({ fincaId, initial }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState(initial.nombre);
  const [ubicacion, setUbicacion] = useState(initial.ubicacion ?? "");
  const [areaHa, setAreaHa] = useState(String(initial.area_ha));
  const [propietario, setPropietario] = useState(initial.propietario ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await actualizarFinca({
      id: fincaId,
      nombre,
      ubicacion: ubicacion.trim() || null,
      area_ha: areaHa,
      propietario: propietario.trim() || null,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/fincas/${fincaId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre de la finca</Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ubicacion">Ubicación</Label>
        <Textarea
          id="ubicacion"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          rows={2}
          className="min-h-[110px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="area_ha">Área total (ha)</Label>
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
        <Label htmlFor="propietario">Propietario (opcional)</Label>
        <Input
          id="propietario"
          value={propietario}
          onChange={(e) => setPropietario(e.target.value)}
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
