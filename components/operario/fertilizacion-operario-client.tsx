"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { registrarAplicacionFertilizacion } from "@/app/actions/fertilizacion";
import type { AplicacionFertilizacionListRow } from "@/app/actions/fertilizacion";
import type { NutricionPendienteRow } from "@/app/actions/queries";
import {
  FertilizacionAplicacionForm,
  METODO_LABEL,
  type FertilizacionConfirmSnapshot,
} from "@/components/campo/fertilizacion-form";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { labelDosisUnidadPlan } from "@/lib/fertilizacion-dosis";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Props = {
  fincaId: string | null;
  pendientes: NutricionPendienteRow[];
  initialHistorial: AplicacionFertilizacionListRow[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FertilizacionOperarioClient({
  fincaId,
  pendientes,
  initialHistorial,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [historial] = useServerPropsState(initialHistorial);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSnapshot, setConfirmSnapshot] = useState<FertilizacionConfirmSnapshot | null>(null);
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return historial;
    return historial.filter((r) => {
      const blob = `${r.fecha_aplicacion} ${r.lote_codigo} ${r.insumo_nombre} ${r.metodo_aplicacion} ${r.cantidad_aplicada}`.toLowerCase();
      return blob.includes(q);
    });
  }, [historial, search]);

  function handleRequestConfirm(snapshot: FertilizacionConfirmSnapshot) {
    setConfirmSnapshot(snapshot);
    setConfirmOpen(true);
  }

  async function onConfirmSubmit() {
    if (!fincaId || !confirmSnapshot) return;

    setPending(true);
    const qty = Number(confirmSnapshot.cantidad.replace(",", "."));
    const res = await registrarAplicacionFertilizacion({
      finca_id: fincaId,
      plan_item_id: confirmSnapshot.selected.plan_item_id,
      fecha_aplicacion: confirmSnapshot.fecha,
      cantidad_aplicada: qty,
      metodo_aplicacion: confirmSnapshot.metodo as "manual" | "equipada" | "fertirriego" | "otro",
      justificacion_desviacion: confirmSnapshot.justificacion.trim() || null,
      notas: confirmSnapshot.notas.trim() || null,
      latitud: confirmSnapshot.coords.lat,
      longitud: confirmSnapshot.coords.lng,
      source: "web",
    });
    setPending(false);
    setConfirmOpen(false);

    if (!res.success) {
      toast(res.error, "error");
      return;
    }

    setCreateOpen(false);
    setConfirmSnapshot(null);
    toast("Aplicación de fertilización registrada.", "success");
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
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por lote, insumo, fecha…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
          />
        </div>
        <Button
          type="button"
          className="shrink-0 gap-1.5"
          disabled={pendientes.length === 0}
          onClick={() => {
            setCreateKey((k) => k + 1);
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          Registrar aplicación
        </Button>
      </div>

      {pendientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay líneas de fertilización pendientes. Cuando el técnico programe un plan
          nutricional para lotes en producción, podrá registrar la aplicación aquí.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "Sin aplicaciones registradas aún. Use «Registrar aplicación» para la primera."}
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Insumo</th>
                  <th className="px-4 py-3">Aplicada / plan</th>
                  <th className="px-4 py-3">Método</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 last:border-0 ${
                      idx % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(r.fecha_aplicacion)}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="px-4 py-3">{r.insumo_nombre}</td>
                    <td className="px-4 py-3">
                      {r.cantidad_aplicada} / {r.dosis_programada}{" "}
                      {labelDosisUnidadPlan(r.dosis_unidad)}
                      {r.desviacion_pct > 10 ? (
                        <span className="ml-1 text-xs text-amber-700">(+{r.desviacion_pct}%)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {METODO_LABEL[r.metodo_aplicacion] ?? r.metodo_aplicacion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar aplicación de fertilización</DialogTitle>
            <DialogDescription>
              Complete la dosis aplicada en campo con ubicación GPS y método de aplicación.
            </DialogDescription>
          </DialogHeader>
          <FertilizacionAplicacionForm
            key={createKey}
            pendientes={pendientes}
            embedded
            onRequestConfirm={handleRequestConfirm}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar aplicación</DialogTitle>
            <DialogDescription>
              Revise los datos antes de enviar el registro en campo.
            </DialogDescription>
          </DialogHeader>
          {confirmSnapshot ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Insumo</dt>
                <dd className="font-medium text-right">{confirmSnapshot.selected.insumo_nombre}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Lote</dt>
                <dd className="font-medium">{confirmSnapshot.selected.lote_codigo}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Dosis aplicada</dt>
                <dd className="font-medium">
                  {confirmSnapshot.cantidad}{" "}
                  {labelDosisUnidadPlan(confirmSnapshot.selected.dosis_unidad)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Dosis programada</dt>
                <dd>
                  {confirmSnapshot.selected.dosis_cantidad}{" "}
                  {labelDosisUnidadPlan(confirmSnapshot.selected.dosis_unidad)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Método</dt>
                <dd>{METODO_LABEL[confirmSnapshot.metodo] ?? confirmSnapshot.metodo}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={() => void onConfirmSubmit()} disabled={pending}>
              {pending ? "Guardando…" : "Confirmar y registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
