"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LOTE_ESTADO_CULTIVO_VALUES,
  labelEstadoCultivo,
  type LoteEstadoCultivo,
} from "@/lib/lote-estado";

type Props = {
  estadoCultivo: LoteEstadoCultivo;
  onEstadoCultivoChange: (v: LoteEstadoCultivo) => void;
  activo: boolean;
  onActivoChange: (v: boolean) => void;
  idPrefix: string;
};

export function LoteEstadoFields({
  estadoCultivo,
  onEstadoCultivoChange,
  activo,
  onActivoChange,
  idPrefix,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-estado`}>Estado del cultivo</Label>
        <Select
          value={estadoCultivo}
          onValueChange={(v) => onEstadoCultivoChange(v as LoteEstadoCultivo)}
        >
          <SelectTrigger
            id={`${idPrefix}-estado`}
            className="min-h-12 w-full rounded-2xl border-border/70 bg-background/80 text-base shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOTE_ESTADO_CULTIVO_VALUES.map((v) => (
              <SelectItem key={v} value={v}>
                {labelEstadoCultivo(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Para planificar siembra use <strong>Vacante</strong> o <strong>Disponible</strong>.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-activo`}>Lote activo</Label>
        <Select
          value={activo ? "true" : "false"}
          onValueChange={(v) => onActivoChange(v === "true")}
        >
          <SelectTrigger
            id={`${idPrefix}-activo`}
            className="min-h-12 w-full rounded-2xl border-border/70 bg-background/80 text-base shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Activo</SelectItem>
            <SelectItem value="false">Inactivo</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Inactivo: no aparece en planificación de siembra ni agenda de labores.
        </p>
      </div>
    </div>
  );
}
