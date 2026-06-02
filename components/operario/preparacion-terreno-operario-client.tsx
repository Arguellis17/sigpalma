"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { registrarPreparacionTerreno } from "@/app/actions/preparacion-terreno";
import type { PreparacionTerrenoListRow } from "@/app/actions/preparacion-terreno";
import type { PreparacionTerrenoPendienteRow } from "@/app/actions/queries";
import {
  ACTIVIDAD_PREPARACION_LABEL,
  PreparacionTerrenoForm,
  type PreparacionConfirmSnapshot,
} from "@/components/campo/preparacion-terreno-form";
import { ACTIVIDADES_PREPARACION_TERRENO } from "@/lib/preparacion-terreno";
import { useServerPropsState } from "@/hooks/use-server-props-state";
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
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSnapshot, setConfirmSnapshot] = useState<PreparacionConfirmSnapshot | null>(null);
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return historial;
    return historial.filter((r) => {
      const estado =
        r.estado === "aprobado" ? "aprobado" : "pendiente validación técnica";
      const blob = `${r.lote_codigo} ${r.pendiente_final_pct} ${estado}`.toLowerCase();
      return blob.includes(q);
    });
  }, [historial, search]);

  function handleRequestConfirm(snapshot: PreparacionConfirmSnapshot) {
    setConfirmSnapshot(snapshot);
    setConfirmOpen(true);
  }

  async function onConfirm() {
    if (!fincaId || !confirmSnapshot) return;

    const pendienteNum = Number(confirmSnapshot.pendiente.replace(",", "."));
    setPending(true);
    const res = await registrarPreparacionTerreno({
      finca_id: fincaId,
      lote_id: confirmSnapshot.selected.lote_id,
      plan_siembra_id: confirmSnapshot.selected.plan_siembra_id,
      pendiente_final_pct: pendienteNum,
      actividades: confirmSnapshot.actividades as typeof ACTIVIDADES_PREPARACION_TERRENO[number][],
      notas: confirmSnapshot.notas.trim() || null,
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

    if (res.data.requiere_validacion_tecnico) {
      toast(
        "Registro guardado. Pendiente de validación técnica por pendiente ≥ 12%.",
        "success"
      );
    } else {
      toast("Preparación registrada. Lote listo para siembra.", "success");
    }

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
            placeholder="Buscar por lote, pendiente, estado…"
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
          Registrar preparación
        </Button>
      </div>

      {pendientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay lotes planificados pendientes de adecuación. El técnico debe crear un plan
          de siembra antes de registrar la preparación del terreno.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "Sin registros aún. Use «Registrar preparación» para el primero."}
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Pendiente</th>
                  <th className="px-4 py-3">Estado</th>
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
      )}

      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar preparación de terreno</DialogTitle>
            <DialogDescription>
              Indique actividades realizadas y pendiente final del lote planificado.
            </DialogDescription>
          </DialogHeader>
          <PreparacionTerrenoForm
            key={createKey}
            pendientes={pendientes}
            embedded
            onRequestConfirm={handleRequestConfirm}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar preparación</DialogTitle>
            <DialogDescription>
              Revise pendiente y actividades antes de guardar (RN55: registro inmutable).
            </DialogDescription>
          </DialogHeader>
          {confirmSnapshot ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Lote</dt>
                <dd className="font-medium">{confirmSnapshot.selected.lote_codigo}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pendiente final</dt>
                <dd>{confirmSnapshot.pendiente}%</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Actividades</dt>
                <dd className="mt-1">
                  {confirmSnapshot.actividades
                    .map(
                      (a) =>
                        ACTIVIDAD_PREPARACION_LABEL[
                          a as keyof typeof ACTIVIDAD_PREPARACION_LABEL
                        ] ?? a
                    )
                    .join(", ")}
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
