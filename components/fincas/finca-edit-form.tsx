"use client";

import { useState } from "react";
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
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function FincaEditForm({ fincaId, initial, onSuccess, onCancel }: Props) {
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
    onSuccess?.();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="fe-nombre">Nombre de la finca <span className="text-destructive">*</span></Label>
        <Input
          id="fe-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fe-ubicacion">Ubicación</Label>
        <Textarea
          id="fe-ubicacion"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          rows={2}
          className="min-h-[90px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fe-area">Área total (ha) <span className="text-destructive">*</span></Label>
          <Input
            id="fe-area"
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
          <Label htmlFor="fe-propietario">Propietario</Label>
          <Input
            id="fe-propietario"
            value={propietario}
            onChange={(e) => setPropietario(e.target.value)}
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

