"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, RefreshCw } from "lucide-react";
import { registrarAplicacionFitosanitaria } from "@/app/actions/fitosanidad";
import type { AplicacionFitosanitariaListRow } from "@/app/actions/fitosanidad";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { parseCantidadDosis, mensajeDesviacionDosis } from "@/lib/sanidad-dosis";
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
import { useToast } from "@/components/ui/toast";

export type OrdenPendienteRow = {
  id: string;
  dosis_recomendada: string;
  lote_codigo: string;
  insumo_nombre: string;
  unidad_medida: string | null;
};

type Props = {
  ordenes: OrdenPendienteRow[];
  initialHistorial: AplicacionFitosanitariaListRow[];
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

function AplicacionForm({ ordenes, onSuccess }: { ordenes: OrdenPendienteRow[]; onSuccess: () => void }) {
  const [ordenId, setOrdenId] = useState(ordenes[0]?.id ?? "");
  const [fecha, setFecha] = useState(() => todayLocalYmd());
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("");
  const [epp, setEpp] = useState(false);
  const [notas, setNotas] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = ordenes.find((o) => o.id === ordenId);
  const dosisRef = selected ? parseCantidadDosis(selected.dosis_recomendada) : null;
  const qtyPreview = Number(cantidad.replace(",", "."));
  const desviacionPreview =
    selected && Number.isFinite(qtyPreview) && qtyPreview > 0
      ? mensajeDesviacionDosis(qtyPreview, selected.dosis_recomendada)
      : null;

  useEffect(() => {
    if (!ordenes.length) return;
    if (!ordenes.some((o) => o.id === ordenId)) {
      setOrdenId(ordenes[0].id);
    }
  }, [ordenes, ordenId]);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!ordenId) {
      setErr("Seleccione una orden.");
      return;
    }
    if (!epp) {
      setErr("Debe confirmar el uso de EPP (RN67).");
      return;
    }
    if (!coords) {
      setErr("Se requiere ubicación GPS para registrar la aplicación en campo.");
      return;
    }
    const qty = Number(cantidad.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr("Indique una cantidad aplicada válida.");
      return;
    }
    if (selected) {
      const desv = mensajeDesviacionDosis(qty, selected.dosis_recomendada);
      if (desv) {
        setErr(desv);
        return;
      }
    }
    setPending(true);
    const res = await registrarAplicacionFitosanitaria({
      orden_id: ordenId,
      fecha_aplicacion: fecha,
      cantidad_aplicada: qty,
      unidad_medida: unidad.trim() || selected?.unidad_medida || null,
      epp_confirmado: true,
      notas: notas.trim() || null,
      latitud: coords.lat,
      longitud: coords.lng,
      source: "web",
    });
    setPending(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setCantidad("");
    setNotas("");
    setEpp(false);
    onSuccess();
  }

  if (ordenes.length === 0) {
    return (
      <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
        No hay órdenes de control autorizadas pendientes de aplicación. Cuando el técnico valide
        el monitoreo y emita una orden, podrá registrarla aquí (RN66).
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="orden">Orden de control</Label>
        <Select value={ordenId} onValueChange={setOrdenId}>
          <SelectTrigger id="orden" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base">
            <SelectValue placeholder="Orden" />
          </SelectTrigger>
          <SelectContent>
            {ordenes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.lote_codigo} — {o.insumo_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected ? (
          <p className="text-xs text-muted-foreground">
            Dosis autorizada:{" "}
            <span className="font-medium text-foreground">{selected.dosis_recomendada}</span>
            {dosisRef != null ? (
              <span className="ml-1">(ref. numérica ~{dosisRef}; máx. +20%)</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha de aplicación</Label>
          <DatePickerField id="fecha" value={fecha} onChange={setFecha} placeholder="Fecha…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cantidad">Cantidad aplicada</Label>
          <Input
            id="cantidad"
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Ej. 2.5"
            className="min-h-12 rounded-2xl"
            required
          />
        </div>
      </div>

      {desviacionPreview ? (
        <p className="text-sm text-destructive" role="alert">
          {desviacionPreview}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="unidad">Unidad (opcional)</Label>
        <Input
          id="unidad"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          placeholder={selected?.unidad_medida ?? "L, kg…"}
          className="min-h-12 rounded-2xl"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          {gpsPending ? (
            <span className="text-muted-foreground">Obteniendo GPS…</span>
          ) : coords ? (
            <span className="tabular-nums text-foreground">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          ) : (
            <span className="text-destructive">GPS no disponible</span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void refreshGps()} disabled={gpsPending}>
          <RefreshCw className="size-3.5" />
          Actualizar GPS
        </Button>
      </div>
      {gpsError ? <p className="text-xs text-destructive">{gpsError}</p> : null}

      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <input
          id="epp"
          type="checkbox"
          checked={epp}
          onChange={(e) => setEpp(e.target.checked)}
          className="mt-1 size-4 rounded border-border"
        />
        <Label htmlFor="epp" className="cursor-pointer text-sm leading-relaxed">
          Confirmo uso de EPP conforme a ficha técnica y procedimientos de la plantación (RN67).
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="rounded-2xl" />
      </div>

      {err ? (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !epp || !coords}
        className="min-h-12 rounded-2xl"
      >
        {pending ? "Guardando…" : "Registrar aplicación y cerrar orden"}
      </Button>
    </form>
  );
}

export function AplicacionesOperarioClient({ ordenes, initialHistorial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [historial] = useServerPropsState(initialHistorial);

  function afterSuccess() {
    toast("Aplicación registrada. Orden cerrada.", "success");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <AplicacionForm ordenes={ordenes} onSuccess={afterSuccess} />

      {historial.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">Aplicaciones recientes</h3>
          <div className="surface-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Cantidad</th>
                    <th className="px-4 py-3">EPP</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/40 last:border-0 ${
                        idx % 2 !== 0 ? "bg-muted/15" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{r.fecha_aplicacion}</td>
                      <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                      <td className="px-4 py-3">{r.insumo_nombre}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.cantidad_aplicada} {r.unidad_medida ?? ""}
                      </td>
                      <td className="px-4 py-3">{r.epp_confirmado ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
