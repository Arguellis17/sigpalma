"use client";

import { useEffect, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import type { NutricionPendienteRow } from "@/app/actions/queries";
import {
  labelDosisUnidadPlan,
  mensajeDesviacionFertilizacion,
  requiereJustificacionDesviacion,
} from "@/lib/fertilizacion-dosis";
import { Button } from "@/components/ui/button";
import { DatePickerField, todayLocalYmd } from "@/components/ui/date-picker-field";
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

const METODO_LABEL: Record<string, string> = {
  manual: "Manual",
  equipada: "Equipada / mecanizada",
  fertirriego: "Fertirriego",
  otro: "Otro",
};

export type FertilizacionConfirmSnapshot = {
  selected: NutricionPendienteRow;
  fecha: string;
  cantidad: string;
  metodo: string;
  justificacion: string;
  notas: string;
  coords: { lat: number; lng: number };
};

async function captureGps(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 12_000,
        maximumAge: 30_000,
        enableHighAccuracy: true,
      });
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

type Props = {
  pendientes: NutricionPendienteRow[];
  embedded?: boolean;
  onRequestConfirm: (snapshot: FertilizacionConfirmSnapshot) => void;
};

export function FertilizacionAplicacionForm({
  pendientes,
  embedded = false,
  onRequestConfirm,
}: Props) {
  const [itemId, setItemId] = useState(pendientes[0]?.plan_item_id ?? "");
  const [fecha, setFecha] = useState(() => todayLocalYmd());
  const [cantidad, setCantidad] = useState("");
  const [metodo, setMetodo] = useState<string>("manual");
  const [justificacion, setJustificacion] = useState("");
  const [notas, setNotas] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selected = pendientes.find((p) => p.plan_item_id === itemId);
  const qtyPreview = Number(cantidad.replace(",", "."));
  const desviacionPreview =
    selected && Number.isFinite(qtyPreview) && qtyPreview > 0
      ? mensajeDesviacionFertilizacion(qtyPreview, selected.dosis_cantidad)
      : null;
  const needsJustificacion =
    selected && Number.isFinite(qtyPreview) && qtyPreview > 0
      ? requiereJustificacionDesviacion(qtyPreview, selected.dosis_cantidad)
      : false;

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6";

  useEffect(() => {
    if (!pendientes.length) return;
    if (!pendientes.some((p) => p.plan_item_id === itemId)) {
      setItemId(pendientes[0].plan_item_id);
    }
  }, [pendientes, itemId]);

  useEffect(() => {
    let cancelled = false;
    setGpsPending(true);
    void captureGps().then((c) => {
      if (cancelled) return;
      setGpsPending(false);
      if (c) {
        setCoords(c);
        setGpsError(null);
      } else {
        setGpsError("No se pudo obtener la ubicación. Use «Actualizar GPS» antes de guardar.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshGps() {
    setGpsPending(true);
    setGpsError(null);
    const c = await captureGps();
    setGpsPending(false);
    if (c) {
      setCoords(c);
    } else {
      setGpsError("Permita el acceso a ubicación en el navegador o dispositivo.");
    }
  }

  function validateForm(): string | null {
    if (!itemId) return "Seleccione una tarea de fertilización programada.";
    if (!coords) return "Se requiere ubicación GPS para registrar la aplicación en campo.";
    const qty = Number(cantidad.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      return "Indique una dosis aplicada válida.";
    }
    if (selected && needsJustificacion && justificacion.trim().length < 10) {
      return "La desviación supera el 10%. Indique una justificación técnica (RN63).";
    }
    if (!selected) return "Seleccione una tarea de fertilización programada.";
    return null;
  }

  function onRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const validationErr = validateForm();
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    if (!selected || !coords) return;
    onRequestConfirm({
      selected,
      fecha,
      cantidad,
      metodo,
      justificacion,
      notas,
      coords,
    });
  }

  return (
    <form onSubmit={onRequestSubmit} className={formClass}>
      <div className="space-y-2">
        <Label htmlFor="tarea">Tarea programada</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger
            id="tarea"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base"
          >
            <SelectValue placeholder="Seleccione…" />
          </SelectTrigger>
          <SelectContent>
            {pendientes.map((p) => (
              <SelectItem key={p.plan_item_id} value={p.plan_item_id}>
                {p.insumo_nombre} · {p.lote_codigo}
                {p.fecha_objetivo ? ` · ${p.fecha_objetivo}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            Dosis objetivo: {selected.dosis_cantidad}{" "}
            {labelDosisUnidadPlan(selected.dosis_unidad)}
          </p>
          <p className="mt-1 text-muted-foreground">
            Lote {selected.lote_codigo}
            {selected.unidad_medida ? ` · unidad insumo: ${selected.unidad_medida}` : ""}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cantidad">
            Dosis aplicada
            {selected ? ` (${labelDosisUnidadPlan(selected.dosis_unidad)})` : ""}
          </Label>
          <Input
            id="cantidad"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha de aplicación</Label>
          <DatePickerField id="fecha" value={fecha} onChange={setFecha} />
        </div>
      </div>

      {desviacionPreview ? (
        <p
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="status"
        >
          {desviacionPreview}
        </p>
      ) : null}

      {needsJustificacion ? (
        <div className="space-y-2">
          <Label htmlFor="justificacion">Justificación técnica (obligatoria)</Label>
          <Textarea
            id="justificacion"
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            rows={3}
            placeholder="Ej. Rebose por lluvia reciente, ajuste por recomendación del técnico…"
            className="min-h-[100px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base"
            required
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="metodo">Método de aplicación</Label>
        <Select value={metodo} onValueChange={setMetodo}>
          <SelectTrigger
            id="metodo"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(METODO_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Observaciones (opcional)</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className="rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0" />
        {gpsPending ? (
          <span>Obteniendo ubicación…</span>
        ) : coords ? (
          <span>
            GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">
            {gpsError ?? "Ubicación no disponible"}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={() => void refreshGps()}
          disabled={gpsPending}
        >
          <RefreshCw className={`size-3.5 ${gpsPending ? "animate-spin" : ""}`} />
          Actualizar GPS
        </Button>
      </div>

      {err ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl sm:w-auto">
        Revisar y enviar
      </Button>
    </form>
  );
}

export { METODO_LABEL };
