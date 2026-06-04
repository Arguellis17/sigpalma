"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, MapPin, RefreshCw, Truck } from "lucide-react";
import {
  crearRemisionDespacho,
  getCosechasDisponiblesDespacho,
  type CosechaDisponibleDespachoRow,
  type RemisionListRow,
} from "@/app/actions/despacho";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type Props = {
  fincaId: string | null;
  initialDisponibles: CosechaDisponibleDespachoRow[];
  initialRemisiones: RemisionListRow[];
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

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DespachoOperarioClient({
  fincaId,
  initialDisponibles,
  initialRemisiones,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [disponibles, setDisponibles] = useServerPropsState(initialDisponibles);
  const [remisiones, setRemisiones] = useServerPropsState(initialRemisiones);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [placa, setPlaca] = useState("");
  const [conductorId, setConductorId] = useState("");
  const [conductorNombre, setConductorNombre] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [destino, setDestino] = useState("Planta extractora / acopio");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmSobrecarga, setConfirmSobrecarga] = useState(false);

  const selectedRows = useMemo(
    () => disponibles.filter((d) => selected.has(d.id)),
    [disponibles, selected]
  );

  const totales = useMemo(() => {
    const kg = selectedRows.reduce((s, r) => s + r.peso_kg, 0);
    const racimos = selectedRows.reduce((s, r) => s + r.conteo_racimos, 0);
    return { kg, ton: kg / 1000, racimos };
  }, [selectedRows]);

  const fechasUnicas = useMemo(
    () => new Set(selectedRows.map((r) => r.fecha)),
    [selectedRows]
  );

  useEffect(() => {
    if (!fincaId) return;
    let cancelled = false;
    setGpsPending(true);
    void captureGps().then((c) => {
      if (cancelled) return;
      setGpsPending(false);
      if (c) setCoords(c);
      else setGpsError("No se pudo obtener GPS. Active ubicación e intente de nuevo.");
    });
    return () => {
      cancelled = true;
    };
  }, [fincaId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refreshDisponibles() {
    if (!fincaId) return;
    const res = await getCosechasDisponiblesDespacho(fincaId);
    if (res.success) {
      setDisponibles(res.data);
      setSelected(new Set());
    }
  }

  async function submit(confirmarSobrecarga: boolean) {
    if (!fincaId) return;
    setErr(null);
    if (selected.size === 0) {
      setErr("Seleccione al menos una cosecha en centro de acopio.");
      return;
    }
    if (fechasUnicas.size > 1) {
      setErr("Todas las cosechas deben ser del mismo día (RN83).");
      return;
    }
    if (!coords) {
      setErr(gpsError ?? "GPS obligatorio para la salida del vehículo.");
      return;
    }
    setPending(true);
    const res = await crearRemisionDespacho({
      finca_id: fincaId,
      cosecha_ids: [...selected],
      placa_vehiculo: placa,
      conductor_identificacion: conductorId,
      conductor_nombre: conductorNombre.trim() || null,
      capacidad_vehiculo_kg: capacidad === "" ? null : Number(capacidad),
      destino: destino.trim() || null,
      latitud: coords.lat,
      longitud: coords.lng,
      confirmar_sobrecarga: confirmarSobrecarga,
    });
    setPending(false);
    setConfirmSobrecarga(false);
    if (!res.success) {
      if (res.error.includes("supera la capacidad")) {
        setConfirmSobrecarga(true);
        return;
      }
      setErr(res.error);
      return;
    }
    toast("Remisión creada.", "success");
    window.open(res.data.pdf_download_url, "_blank");
    setSelected(new Set());
    setPlaca("");
    setConductorId("");
    router.refresh();
    void refreshDisponibles();
  }

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
        No tiene finca asignada.
      </p>
    );
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="surface-panel rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Truck className="size-5 text-primary" />
          <h3 className="font-semibold">Nueva remisión de salida</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Seleccione cosechas en acopio del mismo día. Al cerrar, la fruta pasa a en tránsito (RN85).
        </p>

        {disponibles.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No hay cosechas disponibles en centro de acopio. Registre cosecha primero.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2"> </th>
                  <th className="py-2">Lote</th>
                  <th className="py-2">Fecha</th>
                  <th className="py-2 text-right">Kg</th>
                  <th className="py-2 text-right">Racimos</th>
                </tr>
              </thead>
              <tbody>
                {disponibles.map((d) => (
                  <tr key={d.id} className="border-b border-border/40">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="size-4 rounded border-border"
                        aria-label={`Seleccionar ${d.lote_codigo}`}
                      />
                    </td>
                    <td className="py-2 font-medium">{d.lote_codigo}</td>
                    <td className="py-2 text-muted-foreground">{d.fecha}</td>
                    <td className="py-2 text-right tabular-nums">
                      {d.peso_kg.toLocaleString("es-CO")}
                    </td>
                    <td className="py-2 text-right tabular-nums">{d.conteo_racimos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected.size > 0 ? (
          <p className="mt-3 text-sm font-medium text-primary">
            Total seleccionado: {totales.kg.toLocaleString("es-CO")} kg (
            {totales.ton.toLocaleString("es-CO", { maximumFractionDigits: 3 })} t) ·{" "}
            {totales.racimos} racimos
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="placa">Placa vehículo</Label>
            <Input
              id="placa"
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              placeholder="ABC123"
              className="min-h-11 uppercase"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cond-id">Identificación conductor</Label>
            <Input
              id="cond-id"
              value={conductorId}
              onChange={(e) => setConductorId(e.target.value)}
              className="min-h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cond-nom">Nombre conductor (opc.)</Label>
            <Input
              id="cond-nom"
              value={conductorNombre}
              onChange={(e) => setConductorNombre(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cap">Capacidad vehículo kg (opc.)</Label>
            <NumericInput
              id="cap"
              value={capacidad}
              onValueChange={setCapacidad}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="dest">Destino</Label>
            <Input
              id="dest"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="min-h-11"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">GPS salida</p>
                {gpsPending ? (
                  <p className="text-xs text-muted-foreground">Obteniendo…</p>
                ) : coords ? (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-xs text-destructive">{gpsError}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={gpsPending}
              onClick={async () => {
                setGpsPending(true);
                const c = await captureGps();
                setGpsPending(false);
                if (c) setCoords(c);
                else setGpsError("No se pudo obtener GPS.");
              }}
            >
              <RefreshCw className={`size-3.5 ${gpsPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {err ? (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        ) : null}

        <Button
          type="button"
          className="mt-4 min-h-11 w-full sm:w-auto"
          disabled={pending || selected.size === 0 || !coords}
          onClick={() => submit(false)}
        >
          {pending ? "Generando remisión…" : "Cerrar remisión y descargar PDF"}
        </Button>
      </div>

      <div className="surface-panel overflow-hidden rounded-2xl">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="font-semibold">Historial de remisiones</h3>
        </div>
        {remisiones.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Sin remisiones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3 text-right">Peso (t)</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {remisiones.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="px-4 py-3 font-medium">{r.numero_remision}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(r.fecha_despacho)}
                    </td>
                    <td className="px-4 py-3">{r.placa_vehiculo}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {(r.peso_total_kg / 1000).toLocaleString("es-CO", {
                        maximumFractionDigits: 3,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/api/v1/remisiones/${r.id}/pdf`} target="_blank" rel="noreferrer">
                          <Download className="size-3.5" />
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={confirmSobrecarga} onOpenChange={setConfirmSobrecarga}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advertencia de sobrecarga</DialogTitle>
            <DialogDescription>
              El peso total supera la capacidad indicada del vehículo. ¿Desea continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmSobrecarga(false)}>
              Revisar
            </Button>
            <Button onClick={() => submit(true)} disabled={pending}>
              Confirmar y generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
