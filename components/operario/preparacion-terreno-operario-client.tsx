"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPreparacionTerreno } from "@/app/actions/preparacion-terreno";
import type { PreparacionTerrenoListRow } from "@/app/actions/preparacion-terreno";
import type { PreparacionTerrenoPendienteRow } from "@/app/actions/queries";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import {
  ACTIVIDADES_PREPARACION_TERRENO,
  ACTIVIDAD_PREPARACION_LABEL,
  PENDIENTE_TERRENO_MAX_PCT,
  mensajePendienteCritica,
  pendienteRequiereValidacionTecnico,
} from "@/lib/preparacion-terreno";
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
  pendientes: PreparacionTerrenoPendienteRow[];
  initialHistorial: PreparacionTerrenoListRow[];
};

export function PreparacionTerrenoOperarioClient({
  fincaId,
  pendientes,
  initialHistorial,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [historial] = useServerPropsState(initialHistorial);

  const [loteKey, setLoteKey] = useState(pendientes[0]?.lote_id ?? "");
  const [pendiente, setPendiente] = useState("");
  const [actividades, setActividades] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = pendientes.find((p) => p.lote_id === loteKey);
  const pendienteNum = Number(pendiente.replace(",", "."));
  const pendienteAlerta =
    Number.isFinite(pendienteNum) && pendienteRequiereValidacionTecnico(pendienteNum)
      ? mensajePendienteCritica(pendienteNum)
      : null;

  useEffect(() => {
    if (!pendientes.length) return;
    if (!pendientes.some((p) => p.lote_id === loteKey)) {
      setLoteKey(pendientes[0].lote_id);
    }
  }, [pendientes, loteKey]);

  useEffect(() => {
    if (!selected) return;
    if (pendiente === "" && selected.pendiente_lote_pct != null) {
      setPendiente(String(selected.pendiente_lote_pct));
    }
  }, [selected, pendiente]);

  function toggleActividad(id: string) {
    setActividades((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function validate(): string | null {
    if (!fincaId || !selected) return "Seleccione un lote pendiente.";
    if (actividades.length === 0) {
      return "Seleccione al menos una actividad realizada (RN54).";
    }
    if (!Number.isFinite(pendienteNum) || pendienteNum < 0) {
      return "Indique la pendiente final del terreno.";
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
    const res = await registrarPreparacionTerreno({
      finca_id: fincaId,
      lote_id: selected.lote_id,
      plan_siembra_id: selected.plan_siembra_id,
      pendiente_final_pct: pendienteNum,
      actividades: actividades as typeof ACTIVIDADES_PREPARACION_TERRENO[number][],
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

    if (res.data.requiere_validacion_tecnico) {
      toast(
        "Registro guardado. Pendiente de validación técnica por pendiente ≥ 12%.",
        "success"
      );
    } else {
      toast("Preparación registrada. Lote listo para siembra.", "success");
    }

    setActividades([]);
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
          No hay lotes planificados pendientes de adecuación. El técnico debe crear un plan
          de siembra (HU10) antes de registrar la preparación del terreno.
        </p>
      ) : (
        <form
          onSubmit={onRequestSubmit}
          className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="lote">Lote planificado</Label>
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
                    {p.lote_codigo} · siembra {p.fecha_proyectada}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium">{selected.material_nombre}</p>
              <p className="text-muted-foreground">
                Fecha proyectada de siembra: {selected.fecha_proyectada}
              </p>
            </div>
          ) : null}

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Actividades realizadas</legend>
            {ACTIVIDADES_PREPARACION_TERRENO.map((id) => (
              <label
                key={id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-2"
              >
                <input
                  type="checkbox"
                  className="size-5 rounded border-border accent-primary"
                  checked={actividades.includes(id)}
                  onChange={() => toggleActividad(id)}
                />
                <span>{ACTIVIDAD_PREPARACION_LABEL[id]}</span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="pendiente">
              Pendiente final del terreno (%)
            </Label>
            <Input
              id="pendiente"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              value={pendiente}
              onChange={(e) => setPendiente(e.target.value)}
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base"
              required
            />
            <p className="text-xs text-muted-foreground">
              Debe ser menor al {PENDIENTE_TERRENO_MAX_PCT}% para habilitar siembra
              automáticamente (RN53).
            </p>
          </div>

          {pendienteAlerta ? (
            <p
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
              role="status"
            >
              {pendienteAlerta}
            </p>
          ) : null}

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
            Revisar y registrar
          </Button>
        </form>
      )}

      {historial.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">Registros recientes</h3>
          <div className="surface-panel overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Pendiente</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="px-4 py-3">{r.pendiente_final_pct}%</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.estado === "aprobado"
                        ? "Aprobado"
                        : "Pendiente validación técnica"}
                    </td>
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
            <DialogTitle>Confirmar preparación</DialogTitle>
            <DialogDescription>
              Revise pendiente y actividades antes de guardar (RN55: registro inmutable).
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Lote</dt>
                <dd className="font-medium">{selected.lote_codigo}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pendiente final</dt>
                <dd>{pendiente}%</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Actividades</dt>
                <dd className="mt-1">
                  {actividades.map((a) => ACTIVIDAD_PREPARACION_LABEL[a as keyof typeof ACTIVIDAD_PREPARACION_LABEL] ?? a).join(", ")}
                </dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={() => void onConfirm()} disabled={pending}>
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
