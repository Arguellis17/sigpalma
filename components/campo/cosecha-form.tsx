"use client";

import { useEffect, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { reportarCosecha } from "@/app/actions/cosecha";
import { getLotesCosechables, getMaxPesoCosechaLote } from "@/app/actions/queries";
import {
  mensajePesoInusual,
  pesoEsInusual,
} from "@/lib/cosecha-validacion";
import { Button } from "@/components/ui/button";
import { DatePickerField, todayLocalYmd } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LOTE_SELECT_IDLE = "__lote_idle__";

type FincaRow = { id: string; nombre: string };

type Props = {
  fincas: FincaRow[];
  defaultFincaId: string | null;
  embedded?: boolean;
  onSuccess?: () => void;
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

export function CosechaForm({
  fincas,
  defaultFincaId,
  embedded = false,
  onSuccess,
}: Props) {
  const [fincaId, setFincaId] = useState(
    defaultFincaId ?? fincas[0]?.id ?? ""
  );
  const [loteId, setLoteId] = useState("");
  const [lotes, setLotes] = useState<{ id: string; codigo: string }[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);

  const [fecha, setFecha] = useState(() => todayLocalYmd());
  const [pesoKg, setPesoKg] = useState("");
  const [conteo, setConteo] = useState("");
  const [minFrutos, setMinFrutos] = useState("");
  const [maxFrutos, setMaxFrutos] = useState("");
  const [obs, setObs] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [maxPesoHistorico, setMaxPesoHistorico] = useState<number | null>(null);
  const [confirmPesoOpen, setConfirmPesoOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    id: string;
    rendimiento: number;
  } | null>(null);

  useEffect(() => {
    if (!fincaId) {
      setLotes([]);
      setLoteId("");
      return;
    }
    let cancelled = false;
    setLoadingLotes(true);
    void getLotesCosechables(fincaId, fecha).then((res) => {
      if (cancelled) return;
      setLoadingLotes(false);
      if (res.success) {
        setLotes(res.data);
        setLoteId((prev) =>
          res.data.some((l) => l.id === prev) ? prev : (res.data[0]?.id ?? "")
        );
      } else {
        setLotes([]);
        setLoteId("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fincaId, fecha]);

  useEffect(() => {
    if (!loteId) {
      setMaxPesoHistorico(null);
      return;
    }
    let cancelled = false;
    void getMaxPesoCosechaLote(loteId).then((res) => {
      if (cancelled) return;
      setMaxPesoHistorico(res.success ? res.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [loteId]);

  useEffect(() => {
    let cancelled = false;
    setGpsPending(true);
    setGpsError(null);
    void captureGps().then((c) => {
      if (cancelled) return;
      setGpsPending(false);
      if (c) {
        setCoords(c);
      } else {
        setGpsError(
          "No se pudo obtener la ubicación GPS. Active el permiso de ubicación e intente de nuevo."
        );
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
      setGpsError("No se pudo obtener la ubicación GPS.");
    }
  }

  const pesoNum = Number(pesoKg.replace(",", "."));
  const pesoInusualPreview =
    Number.isFinite(pesoNum) &&
    pesoNum > 0 &&
    pesoEsInusual(pesoNum, maxPesoHistorico);

  async function submitCosecha(confirmarPesoInusual: boolean) {
    setError(null);
    setResultado(null);
    if (!fincaId || !loteId) {
      setError("Seleccione finca y lote apto para cosecha.");
      return;
    }
    if (!coords) {
      setError(gpsError ?? "Active la ubicación GPS antes de registrar.");
      return;
    }
    setPending(true);
    const res = await reportarCosecha({
      finca_id: fincaId,
      lote_id: loteId,
      fecha,
      peso_kg: pesoNum,
      conteo_racimos: Number(conteo),
      madurez_frutos_caidos_min:
        minFrutos === "" ? null : Number.parseInt(minFrutos, 10),
      madurez_frutos_caidos_max:
        maxFrutos === "" ? null : Number.parseInt(maxFrutos, 10),
      observaciones_calidad: obs.trim() || null,
      latitud: coords.lat,
      longitud: coords.lng,
      confirmar_peso_inusual: confirmarPesoInusual,
      source: "web",
    });
    setPending(false);
    setConfirmPesoOpen(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setPesoKg("");
    setConteo("");
    setObs("");
    if (onSuccess) {
      onSuccess();
      return;
    }
    setResultado({
      id: res.data.id,
      rendimiento: res.data.rendimiento_ton_ha,
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      pesoInusualPreview &&
      maxPesoHistorico != null &&
      maxPesoHistorico > 0
    ) {
      setConfirmPesoOpen(true);
      return;
    }
    await submitCosecha(false);
  }

  if (fincas.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        No hay fincas visibles para su cuenta. Verifique su asignación con un
        administrador.
      </p>
    );
  }

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6";

  return (
    <>
      <form onSubmit={onSubmit} className={formClass}>
        <div className="space-y-2">
          <Label htmlFor="c-finca">Finca</Label>
          <Select value={fincaId} onValueChange={setFincaId}>
            <SelectTrigger id="c-finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
              <SelectValue placeholder="Finca" />
            </SelectTrigger>
            <SelectContent>
              {fincas.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-lote">Lote (en producción, ≥3 años)</Label>
          <Select
            value={
              !loadingLotes && lotes.length > 0 && lotes.some((l) => l.id === loteId)
                ? loteId
                : LOTE_SELECT_IDLE
            }
            onValueChange={(v) => {
              if (v !== LOTE_SELECT_IDLE) setLoteId(v);
            }}
            disabled={loadingLotes || lotes.length === 0}
          >
            <SelectTrigger id="c-lote" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
              <SelectValue
                placeholder={
                  loadingLotes
                    ? "Cargando…"
                    : lotes.length === 0
                      ? "Sin lotes aptos"
                      : "Lote"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOTE_SELECT_IDLE} disabled className="opacity-60">
                {loadingLotes
                  ? "Cargando…"
                  : lotes.length === 0
                    ? "Sin lotes aptos para cosecha"
                    : "Seleccione un lote…"}
              </SelectItem>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loadingLotes && lotes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Solo aparecen lotes en producción con al menos 3 años desde la siembra (RN78).
              Verifique el estado del lote o solicite al agrónomo programar la labor «Cosecha RFF».
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-fecha">Fecha de cosecha</Label>
          <DatePickerField
            id="c-fecha"
            value={fecha}
            onChange={setFecha}
            placeholder="Elegir fecha de cosecha…"
          />
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Ubicación GPS</p>
                {gpsPending ? (
                  <p className="text-xs text-muted-foreground">Obteniendo coordenadas…</p>
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
              className="shrink-0 gap-1"
              onClick={refreshGps}
              disabled={gpsPending}
            >
              <RefreshCw className={`size-3.5 ${gpsPending ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="peso">Peso total (kg)</Label>
          <NumericInput
            id="peso"
            value={pesoKg}
            onValueChange={setPesoKg}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            required
          />
          {pesoInusualPreview && maxPesoHistorico != null ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {mensajePesoInusual(pesoNum, maxPesoHistorico)}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="racimos">Conteo de racimos</Label>
          <NumericInput
            id="racimos"
            integer
            value={conteo}
            onValueChange={setConteo}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minf">Frutos caídos min (opc.)</Label>
            <NumericInput
              id="minf"
              integer
              value={minFrutos}
              onValueChange={setMinFrutos}
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxf">Frutos caídos max (opc.)</Label>
            <NumericInput
              id="maxf"
              integer
              value={maxFrutos}
              onValueChange={setMaxFrutos}
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs">Observaciones de calidad (opc.)</Label>
          <Textarea
            id="obs"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
            className="min-h-[100px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
          />
        </div>
        {error ? (
          <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {resultado ? (
          <p className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900">
            Cosecha registrada. Rendimiento aproximado:{" "}
            <strong>
              {resultado.rendimiento.toLocaleString("es-CO", {
                maximumFractionDigits: 3,
              })}{" "}
              t/ha
            </strong>
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto"
          disabled={pending || gpsPending || !coords || lotes.length === 0}
        >
          {pending ? "Guardando…" : "Registrar cosecha RFF"}
        </Button>
      </form>

      <Dialog open={confirmPesoOpen} onOpenChange={setConfirmPesoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar peso inusual</DialogTitle>
            <DialogDescription>
              {maxPesoHistorico != null
                ? mensajePesoInusual(pesoNum, maxPesoHistorico)
                : "El peso supera el umbral histórico del lote."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmPesoOpen(false)} disabled={pending}>
              Revisar
            </Button>
            <Button onClick={() => submitCosecha(true)} disabled={pending}>
              {pending ? "Guardando…" : "Confirmar y registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
