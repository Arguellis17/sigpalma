"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarSiembraPlantulas } from "@/app/actions/siembra-plantulas";
import type { RegistroSiembraListRow } from "@/app/actions/siembra-plantulas";
import type { SiembraPendienteRow } from "@/app/actions/queries";
import { useServerPropsState } from "@/hooks/use-server-props-state";
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
  pendientes: SiembraPendienteRow[];
  initialHistorial: RegistroSiembraListRow[];
};

export function SiembraOperarioClient({
  fincaId,
  pendientes,
  initialHistorial,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [historial] = useServerPropsState(initialHistorial);

  const [loteKey, setLoteKey] = useState(pendientes[0]?.lote_id ?? "");
  const [fecha, setFecha] = useState(() => todayLocalYmd());
  const [cantidad, setCantidad] = useState("");
  const [profundidad, setProfundidad] = useState(false);
  const [orientacion, setOrientacion] = useState(false);
  const [notas, setNotas] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = pendientes.find((p) => p.lote_id === loteKey);
  const qty = Number(cantidad.replace(",", "."));

  useEffect(() => {
    if (!pendientes.length) return;
    if (!pendientes.some((p) => p.lote_id === loteKey)) {
      setLoteKey(pendientes[0].lote_id);
    }
  }, [pendientes, loteKey]);

  function validate(): string | null {
    if (!fincaId || !selected) return "Seleccione un lote listo para siembra.";
    if (!profundidad || !orientacion) {
      return "Confirme profundidad y orientación de plúmula/radícula.";
    }
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return "Indique un número entero de palmas sembradas.";
    }
    if (selected.max_palmas != null && qty > selected.max_palmas) {
      return `La cantidad supera el máximo permitido (${selected.max_palmas} palmas).`;
    }
    return null;
  }

  function onRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setConfirmOpen(true);
  }

  async function onConfirm() {
    const v = validate();
    if (v || !fincaId || !selected) {
      setErr(v);
      setConfirmOpen(false);
      return;
    }

    setPending(true);
    const res = await registrarSiembraPlantulas({
      finca_id: fincaId,
      lote_id: selected.lote_id,
      plan_siembra_id: selected.plan_siembra_id,
      preparacion_terreno_id: selected.preparacion_terreno_id,
      fecha_siembra: fecha,
      cantidad_palmas: qty,
      confirmacion_profundidad: true,
      confirmacion_orientacion: true,
      notas: notas.trim() || null,
      source: "web",
    });
    setPending(false);
    setConfirmOpen(false);

    if (!res.success) {
      setErr(res.error);
      toast(res.error, "error");
      return;
    }

    toast("Siembra registrada. Lote en producción.", "success");
    setCantidad("");
    setProfundidad(false);
    setOrientacion(false);
    setNotas("");
    router.refresh();
  }

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
        No hay finca asignada a su cuenta.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {pendientes.length === 0 ? (
        <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
          No hay lotes listos para siembra. Complete la preparación de terreno y verifique
          que el lote esté en estado «Listo para siembra».
        </p>
      ) : (
        <form
          onSubmit={onRequestSubmit}
          className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="lote">Lote</Label>
            <Select value={loteKey} onValueChange={setLoteKey}>
              <SelectTrigger
                id="lote"
                className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base"
              >
                <SelectValue placeholder="Seleccione lote…" />
              </SelectTrigger>
              <SelectContent>
                {pendientes.map((p) => (
                  <SelectItem key={p.lote_id} value={p.lote_id}>
                    {p.lote_codigo} · {p.material_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium">Material genético: {selected.material_nombre}</p>
              <p className="text-muted-foreground">
                Plan siembra {selected.fecha_proyectada} · {selected.area_ha} ha
                {selected.max_palmas != null
                  ? ` · máx. ${selected.max_palmas} palmas`
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de siembra</Label>
              <DatePickerField id="fecha" value={fecha} onChange={setFecha} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidad">Palmas sembradas</Label>
              <Input
                id="cantidad"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base"
                required
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Confirmaciones técnicas</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-2">
              <input
                type="checkbox"
                className="size-5 rounded border-border accent-primary"
                checked={profundidad}
                onChange={(e) => setProfundidad(e.target.checked)}
              />
              <span>Profundidad de siembra conforme a estándar técnico</span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-2">
              <input
                type="checkbox"
                className="size-5 rounded border-border accent-primary"
                checked={orientacion}
                onChange={(e) => setOrientacion(e.target.checked)}
              />
              <span>Orientación correcta de plúmula y radícula</span>
            </label>
          </fieldset>

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

          {err ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
              {err}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="min-h-12 rounded-2xl" disabled={pending}>
            Revisar y registrar siembra
          </Button>
        </form>
      )}

      {historial.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">Siembras registradas</h3>
          <div className="surface-panel overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Palmas</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{r.fecha_siembra}</td>
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="px-4 py-3">{r.material_nombre}</td>
                    <td className="px-4 py-3">{r.cantidad_palmas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar siembra</DialogTitle>
            <DialogDescription>
              El material genético se tomará del plan de siembra. El lote pasará a
              producción.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Lote</dt>
                <dd className="font-medium">{selected.lote_codigo}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Material</dt>
                <dd>{selected.material_nombre}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Palmas</dt>
                <dd>{cantidad}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={() => void onConfirm()} disabled={pending}>
              {pending ? "Guardando…" : "Confirmar siembra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
