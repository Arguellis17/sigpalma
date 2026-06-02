"use client";

import { useState } from "react";
import { crearRegistroGerminacion } from "@/app/actions/germinacion";
import type {
  CatalogoMaterialGeneticoOption,
  LoteOption,
} from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LOTE_NONE = "__none__";

type Props = {
  fincaId: string;
  defaultFecha: string;
  materiales: CatalogoMaterialGeneticoOption[];
  lotes: LoteOption[];
  embedded?: boolean;
  onSuccess?: () => void;
};

export function GerminacionForm({
  fincaId,
  defaultFecha,
  materiales,
  lotes,
  embedded = false,
  onSuccess,
}: Props) {
  const [catalogoMaterialId, setCatalogoMaterialId] = useState(
    materiales[0]?.id ?? ""
  );
  const [loteId, setLoteId] = useState<string>(LOTE_NONE);
  const [fechaTratamiento, setFechaTratamiento] = useState(defaultFecha);
  const [temperaturaMax, setTemperaturaMax] = useState("40");
  const [diasTratamiento, setDiasTratamiento] = useState("7");
  const [notas, setNotas] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel space-y-4 rounded-2xl p-5 sm:p-6";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!catalogoMaterialId) {
      setErr("Seleccione material genético.");
      return;
    }
    setPending(true);
    const res = await crearRegistroGerminacion({
      finca_id: fincaId,
      catalogo_material_id: catalogoMaterialId,
      lote_id: loteId === LOTE_NONE ? null : loteId,
      fecha_tratamiento: fechaTratamiento,
      temperatura_max_c: Number(temperaturaMax),
      dias_tratamiento: Number(diasTratamiento),
      notas: notas.trim() || null,
    });
    setPending(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    if (onSuccess) {
      onSuccess();
      return;
    }
    setNotas("");
  }

  return (
    <form onSubmit={onSubmit} className={formClass}>
      {!embedded ? (
        <>
          <h3 className="text-lg font-semibold text-foreground">Nuevo registro</h3>
          <p className="text-sm text-muted-foreground">
            Tratamiento térmico / germinación vinculado al material genético de la finca.
            Temperatura máxima &gt; 42 °C requiere comentario.
          </p>
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mat">Material genético</Label>
          <Select value={catalogoMaterialId} onValueChange={setCatalogoMaterialId}>
            <SelectTrigger id="mat">
              <SelectValue placeholder="Seleccione…" />
            </SelectTrigger>
            <SelectContent>
              {materiales.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lote">Lote (opcional)</Label>
          <Select value={loteId} onValueChange={setLoteId}>
            <SelectTrigger id="lote">
              <SelectValue placeholder="Sin lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOTE_NONE}>Sin lote</SelectItem>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha tratamiento</Label>
          <Input
            id="fecha"
            type="date"
            value={fechaTratamiento}
            onChange={(e) => setFechaTratamiento(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="temp">Temperatura máx. (°C)</Label>
          <Input
            id="temp"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={temperaturaMax}
            onChange={(e) => setTemperaturaMax(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dias">Días tratamiento</Label>
          <Input
            id="dias"
            type="number"
            min={1}
            max={365}
            value={diasTratamiento}
            onChange={(e) => setDiasTratamiento(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notas">Notas / comentario validación</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Obligatorio si temperatura &gt; 42 °C"
        />
      </div>
      {err ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {err}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || materiales.length === 0}>
        {pending ? "Guardando…" : "Registrar germinación"}
      </Button>
    </form>
  );
}
