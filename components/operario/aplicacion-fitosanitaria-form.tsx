"use client";

import { useState } from "react";
import { registrarAplicacionFitosanitaria } from "@/app/actions/fitosanidad";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
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

export type OrdenPendienteRow = {
  id: string;
  dosis_recomendada: string;
  lote_codigo: string;
  insumo_nombre: string;
  unidad_medida: string | null;
};

type Props = {
  ordenes: OrdenPendienteRow[];
};

export function AplicacionFitosanitariaForm({ ordenes }: Props) {
  const [ordenId, setOrdenId] = useState(ordenes[0]?.id ?? "");
  const [fecha, setFecha] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("");
  const [epp, setEpp] = useState(false);
  const [notas, setNotas] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selected = ordenes.find((o) => o.id === ordenId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!ordenId) {
      setErr("Seleccione una orden.");
      return;
    }
    const qty = Number(cantidad.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr("Indique una cantidad aplicada válida.");
      return;
    }
    let lat: number | null = null;
    let lng: number | null = null;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 8000,
            maximumAge: 60_000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        /* opcional */
      }
    }
    setPending(true);
    const res = await registrarAplicacionFitosanitaria({
      orden_id: ordenId,
      fecha_aplicacion: fecha,
      cantidad_aplicada: qty,
      unidad_medida: unidad.trim() || selected?.unidad_medida || null,
      epp_confirmado: epp,
      notas: notas.trim() || null,
      latitud: lat,
      longitud: lng,
      source: "web",
    });
    setPending(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setMsg(`Aplicación registrada (id ${res.data.id.slice(0, 8)}…). La orden quedó cerrada.`);
    setCantidad("");
    setNotas("");
    setEpp(false);
  }

  if (ordenes.length === 0) {
    return (
      <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
        No hay órdenes de control autorizadas pendientes de aplicación. El técnico
        debe validar una alerta y emitir una orden (RF15).
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
          <SelectTrigger id="orden" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue placeholder="Orden" />
          </SelectTrigger>
          <SelectContent>
            {ordenes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.lote_codigo} — {o.insumo_nombre} (orden {o.id.slice(0, 8)}…)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected ? (
          <p className="text-xs text-muted-foreground">
            Dosis recomendada por el técnico:{" "}
            <span className="font-medium text-foreground">
              {selected.dosis_recomendada}
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha de aplicación</Label>
          <DatePickerField
            id="fecha"
            value={fecha}
            onChange={setFecha}
            placeholder="Elegir fecha de aplicación…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cantidad">Cantidad aplicada</Label>
          <Input
            id="cantidad"
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Ej. 2.5"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unidad">Unidad (opcional)</Label>
        <Input
          id="unidad"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          placeholder={selected?.unidad_medida ?? "L, kg…"}
          className="min-h-12 rounded-2xl border-border/70 bg-background/80"
        />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <input
          id="epp"
          type="checkbox"
          checked={epp}
          onChange={(e) => setEpp(e.target.checked)}
          className="mt-1 size-4 rounded border-border"
        />
        <Label htmlFor="epp" className="cursor-pointer text-sm leading-relaxed">
          Confirmo que se utilizó el equipo de protección personal (EPP) según ficha
          técnica y normativa de la plantación (RN-11 / RF23).
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className="rounded-2xl border-border/70 bg-background/80"
        />
      </div>

      {err ? (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-primary" role="status">
          {msg}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="min-h-12 rounded-2xl">
        {pending ? "Guardando…" : "Registrar aplicación y cerrar orden"}
      </Button>
    </form>
  );
}
