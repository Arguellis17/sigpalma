"use client";

import { useEffect, useState } from "react";
import { registrarLaborEjecutada } from "@/app/actions/labores";
import { useFincaLoteOptions } from "@/hooks/use-finca-lote-options";
import {
  UNIDAD_MEDIDA_LABOR_LABEL,
  type UnidadMedidaLabor,
} from "@/lib/labor-ejecucion";
import type { LaborPendienteRow } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { DatePickerField, todayLocalYmd } from "@/components/ui/date-picker-field";
import { todayColombiaYmd } from "@/lib/date-colombia";
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

const LOTE_SELECT_IDLE = "__lote_idle__";
const CATALOGO_SELECT_IDLE = "__catalogo_idle__";
const PENDIENTE_SELECT_IDLE = "__pendiente_idle__";

type FincaRow = { id: string; nombre: string };
type CatalogoRow = { id: string; nombre: string };

type Props = {
  fincas: FincaRow[];
  defaultFincaId: string | null;
  catalogoLabores: CatalogoRow[];
  pendientes: LaborPendienteRow[];
  initialLotes?: { id: string; codigo: string }[];
  embedded?: boolean;
  open?: boolean;
  defaultFechaYmd?: string;
  defaultPendienteId?: string;
  onSuccess?: () => void;
};

export function LaborForm({
  fincas,
  defaultFincaId,
  catalogoLabores,
  pendientes,
  initialLotes,
  embedded = false,
  open = true,
  defaultFechaYmd,
  defaultPendienteId,
  onSuccess,
}: Props) {
  const { fincaId, setFincaId, loteId, setLoteId, lotes, loadingLotes } =
    useFincaLoteOptions(fincas, defaultFincaId, initialLotes);

  const [pendienteId, setPendienteId] = useState(PENDIENTE_SELECT_IDLE);
  const [catalogoId, setCatalogoId] = useState(CATALOGO_SELECT_IDLE);
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState<UnidadMedidaLabor>("palmas");
  const [fecha, setFecha] = useState(() => todayLocalYmd());
  const [notas, setNotas] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendienteSeleccionada =
    pendienteId !== PENDIENTE_SELECT_IDLE
      ? pendientes.find((p) => p.id === pendienteId)
      : undefined;

  useEffect(() => {
    if (!open) return;
    setFecha(defaultFechaYmd ?? todayLocalYmd());
    setCantidad("");
    setUnidad("palmas");
    setError(null);
    setMessage(null);
    if (defaultPendienteId) {
      setPendienteId(defaultPendienteId);
    } else {
      setPendienteId(PENDIENTE_SELECT_IDLE);
      setCatalogoId(CATALOGO_SELECT_IDLE);
      setNotas("");
    }
  }, [open, defaultFechaYmd, defaultPendienteId]);

  useEffect(() => {
    if (!pendienteSeleccionada) return;
    setCatalogoId(pendienteSeleccionada.catalogo_item_id);
    setLoteId(pendienteSeleccionada.lote_id);
    setFecha(pendienteSeleccionada.fecha_ejecucion);
    setNotas(pendienteSeleccionada.notas ?? "");
  }, [pendienteSeleccionada, setLoteId]);

  function resetAdHoc() {
    setPendienteId(PENDIENTE_SELECT_IDLE);
    setCatalogoId(CATALOGO_SELECT_IDLE);
    setCantidad("");
    setUnidad("palmas");
    setFecha(todayLocalYmd());
    setNotas("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!fincaId) {
      setError("Seleccione finca.");
      return;
    }
    if (catalogoId === CATALOGO_SELECT_IDLE) {
      setError("Seleccione el tipo de labor del catálogo.");
      return;
    }
    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      setError("Indique una cantidad mayor a cero.");
      return;
    }
    if (!pendienteSeleccionada && !loteId) {
      setError("Seleccione finca y lote.");
      return;
    }

    setPending(true);
    const result = await registrarLaborEjecutada({
      finca_id: fincaId,
      lote_id: pendienteSeleccionada?.lote_id ?? loteId,
      catalogo_item_id: catalogoId,
      cantidad_ejecutada: cantidadNum,
      unidad_medida: unidad,
      fecha_ejecucion: fecha,
      notas: notas.trim() || null,
      labor_programada_id: pendienteSeleccionada?.id ?? null,
      source: "web",
    });
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    resetAdHoc();
    if (onSuccess) {
      onSuccess();
      return;
    }
    setMessage("Labor registrada correctamente.");
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

  const catalogoLocked = !!pendienteSeleccionada;

  return (
    <form onSubmit={onSubmit} className={formClass}>
      {pendientes.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <Label htmlFor="pendiente">Tarea programada asignada (opcional)</Label>
          <Select
            value={pendienteId}
            onValueChange={(v) => {
              if (v === PENDIENTE_SELECT_IDLE) {
                resetAdHoc();
                return;
              }
              setPendienteId(v);
            }}
          >
            <SelectTrigger
              id="pendiente"
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none"
            >
              <SelectValue placeholder="Seleccione una tarea pendiente…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PENDIENTE_SELECT_IDLE}>
                Registrar sin programación previa
              </SelectItem>
              {pendientes.map((p) => {
                const hoy = todayColombiaYmd();
                const futura = p.fecha_ejecucion > hoy;
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {p.tipo} · {p.lote_codigo} · {p.fecha_ejecucion}
                    {futura ? " (programada)" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Las tareas que el técnico le asignó aparecen aquí (incluidas fechas futuras).
            Al reportar la ejecución, el lote debe estar en producción.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="finca">Finca</Label>
        <Select value={fincaId} onValueChange={setFincaId}>
          <SelectTrigger
            id="finca"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none"
          >
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

      {!catalogoLocked ? (
        <div className="space-y-2">
          <Label htmlFor="lote">Lote</Label>
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
            <SelectTrigger
              id="lote"
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none"
            >
              <SelectValue
                placeholder={
                  loadingLotes
                    ? "Cargando…"
                    : lotes.length === 0
                      ? "Sin lotes en esta finca"
                      : "Lote"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOTE_SELECT_IDLE} disabled className="opacity-60">
                {loadingLotes
                  ? "Cargando…"
                  : lotes.length === 0
                    ? "Sin lotes en esta finca"
                    : "Seleccione un lote…"}
              </SelectItem>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : pendienteSeleccionada ? (
        <div className="space-y-1">
          <Label>Lote</Label>
          <p className="min-h-12 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-base font-medium">
            {pendienteSeleccionada.lote_codigo}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="catalogo">Tipo de labor</Label>
        <Select
          value={catalogoId}
          onValueChange={setCatalogoId}
          disabled={catalogoLocked || catalogoLabores.length === 0}
        >
          <SelectTrigger
            id="catalogo"
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none"
          >
            <SelectValue
              placeholder={
                catalogoLabores.length === 0
                  ? "Sin labores en catálogo"
                  : "Seleccione del catálogo…"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATALOGO_SELECT_IDLE} disabled className="opacity-60">
              Seleccione del catálogo…
            </SelectItem>
            {catalogoLabores.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cantidad">Cantidad ejecutada</Label>
          <Input
            id="cantidad"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={unidad === "ha" ? "Ej. 2.5" : "Ej. 120"}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unidad">Unidad</Label>
          <Select
            value={unidad}
            onValueChange={(v) => setUnidad(v as UnidadMedidaLabor)}
          >
            <SelectTrigger
              id="unidad"
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(UNIDAD_MEDIDA_LABOR_LABEL) as UnidadMedidaLabor[]).map(
                (u) => (
                  <SelectItem key={u} value={u}>
                    {UNIDAD_MEDIDA_LABOR_LABEL[u]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fecha">Fecha de ejecución</Label>
        <DatePickerField
          id="fecha"
          value={fecha}
          onChange={setFecha}
          placeholder="Elegir fecha de ejecución…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Observaciones (opcional)</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className="min-h-[110px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
        />
      </div>

      {error ? (
        <p
          className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto"
        disabled={pending}
      >
        {pending ? "Guardando…" : "Finalizar labor"}
      </Button>
    </form>
  );
}
