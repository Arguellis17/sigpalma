"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  actualizarPlanSiembra,
  anularPlanSiembra,
  crearPlanSiembra,
} from "@/app/actions/plan-siembra";
import type {
  CatalogoMaterialGeneticoOption,
  LotePlanificableOption,
  PlanSiembraListRow,
} from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayColombiaYmd } from "@/lib/date-colombia";
import { useToast } from "@/components/ui/toast";

type Props = {
  fincaId: string;
  catalogoMaterial: CatalogoMaterialGeneticoOption[];
  lotesPlanificables: LotePlanificableOption[];
  planesIniciales: PlanSiembraListRow[];
};

const IDLE_LOTE = "__lote_idle__";
const IDLE_MAT = "__mat_idle__";

function pendienteEsNumero(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function requiereConfirmacionErosion(pendientePct: string | null | undefined): boolean {
  const n = pendienteEsNumero(pendientePct);
  return n !== null && n > 12;
}

export function PlanSiembraClient({
  fincaId,
  catalogoMaterial,
  lotesPlanificables,
  planesIniciales: planes,
}: Props) {
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loteId, setLoteId] = useState("");
  const [catalogoId, setCatalogoId] = useState("");
  const [fechaYmd, setFechaYmd] = useState(() => todayColombiaYmd());
  const [notas, setNotas] = useState("");
  const [confirmacionErosion, setConfirmacionErosion] = useState(false);
  const [pending, setPending] = useState(false);

  const [anularOpen, setAnularOpen] = useState(false);
  const [anularId, setAnularId] = useState<string | null>(null);

  const pendienteSeleccionado = useMemo(() => {
    if (editingId) {
      const row = planes.find((p) => p.id === editingId);
      return row?.pendiente_pct ?? null;
    }
    const l = lotesPlanificables.find((x) => x.id === loteId);
    return l?.pendiente_pct ?? null;
  }, [editingId, planes, loteId, lotesPlanificables]);

  const mostrarAdvertenciaPendiente = requiereConfirmacionErosion(pendienteSeleccionado);

  function openCreate() {
    setEditingId(null);
    setLoteId(lotesPlanificables[0]?.id ?? IDLE_LOTE);
    setCatalogoId(catalogoMaterial[0]?.id ?? IDLE_MAT);
    setFechaYmd(todayColombiaYmd());
    setNotas("");
    setConfirmacionErosion(false);
    setDialogOpen(true);
  }

  function openEdit(row: PlanSiembraListRow) {
    setEditingId(row.id);
    setLoteId(row.lote_id);
    setCatalogoId(row.catalogo_material_id);
    setFechaYmd(row.fecha_proyectada);
    setNotas(row.notas ?? "");
    setConfirmacionErosion(row.confirmacion_erosion);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogoId || catalogoId === IDLE_MAT) {
      toast("Seleccione material genético del catálogo.", "error");
      return;
    }

    if (!editingId) {
      if (!loteId || loteId === IDLE_LOTE) {
        toast("Seleccione un lote elegible (vacante o disponible).", "error");
        return;
      }
      if (mostrarAdvertenciaPendiente && !confirmacionErosion) {
        toast("Confirme el riesgo de erosión (pendiente > 12%).", "error");
        return;
      }
      setPending(true);
      const result = await crearPlanSiembra({
        finca_id: fincaId,
        lote_id: loteId,
        catalogo_material_id: catalogoId,
        fecha_proyectada: fechaYmd,
        confirmacion_erosion: confirmacionErosion,
        notas: notas.trim() || null,
      });
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast("Plan de siembra registrado. El lote queda planificado.");
    } else {
      if (mostrarAdvertenciaPendiente && !confirmacionErosion) {
        toast("Confirme el riesgo de erosión (pendiente > 12%).", "error");
        return;
      }
      setPending(true);
      const result = await actualizarPlanSiembra({
        id: editingId,
        catalogo_material_id: catalogoId,
        fecha_proyectada: fechaYmd,
        confirmacion_erosion: confirmacionErosion,
        notas: notas.trim() || null,
      });
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast("Plan actualizado.");
    }

    setDialogOpen(false);
    window.location.reload();
  }

  async function confirmarAnular() {
    if (!anularId) return;
    setPending(true);
    const result = await anularPlanSiembra({ id: anularId });
    setPending(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Plan anulado. El lote vuelve a disponible si aplicaba.");
    setAnularOpen(false);
    setAnularId(null);
    window.location.reload();
  }

  const hayCatalogo = catalogoMaterial.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={openCreate} disabled={!hayCatalogo}>
          Nuevo plan de siembra
        </Button>
        {!hayCatalogo ? (
          <p className="text-sm text-muted-foreground">
            No hay material genético activo en catálogo. Solicite carga en Catálogos → Material
            genético.
          </p>
        ) : null}
      </div>

      {planes.length === 0 ? (
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
          No hay planes de siembra vigentes. Los lotes deben estar en estado{" "}
          <strong className="text-foreground">vacante</strong> o{" "}
          <strong className="text-foreground">disponible</strong> para crear un plan (RN26).
        </p>
      ) : (
        <div className="surface-panel overflow-hidden rounded-[1.25rem] ring-1 ring-border/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Fecha proyectada</th>
                  <th className="px-4 py-3">Pendiente %</th>
                  <th className="px-4 py-3">RN28</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {planes.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border/40 last:border-0 ${
                      idx % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{row.lote_codigo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.material_nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(`${row.fecha_proyectada}T12:00:00`), "d MMM yyyy", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.pendiente_pct ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {requiereConfirmacionErosion(row.pendiente_pct)
                        ? row.confirmacion_erosion
                          ? "Confirmado"
                          : "—"
                        : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => openEdit(row)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => {
                            setAnularId(row.id);
                            setAnularOpen(true);
                          }}
                        >
                          Anular
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar plan de siembra" : "Nuevo plan de siembra"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {!editingId ? (
                <div className="grid gap-2">
                  <Label>Lote (vacante o disponible)</Label>
                  <Select value={loteId || IDLE_LOTE} onValueChange={setLoteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione lote" />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesPlanificables.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.codigo}
                          {pendienteEsNumero(l.pendiente_pct) !== null
                            ? ` · pend. ${l.pendiente_pct}%`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lotesPlanificables.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hay lotes elegibles. Marque lotes como vacante/disponible en la ficha del
                      lote o cree nuevos lotes con ese estado.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Lote asociado no cambia en la edición. Use anular si debe reprogramarse en otro
                  lote.
                </p>
              )}

              <div className="grid gap-2">
                <Label>Material genético (catálogo)</Label>
                <Select value={catalogoId || IDLE_MAT} onValueChange={setCatalogoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione variedad" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogoMaterial.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Fecha proyectada</Label>
                <DatePickerField value={fechaYmd} onChange={setFechaYmd} />
              </div>

              {mostrarAdvertenciaPendiente ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Pendiente del terreno mayor al 12% (RN28).
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirme que asume el riesgo de erosión al planificar la siembra en este lote.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={confirmacionErosion}
                      onChange={(e) => setConfirmacionErosion(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border border-input"
                    />
                    <span className="text-sm leading-snug">
                      Confirmo conocer el riesgo de erosión por pendiente elevada.
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="notas-plan-siembra">Notas (opcional)</Label>
                <Textarea
                  id="notas-plan-siembra"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  className="resize-none rounded-xl"
                  placeholder="Observaciones internas…"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : editingId ? "Guardar" : "Crear plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Anular plan de siembra</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            El plan quedará anulado y el lote podrá volver a estado disponible si estaba planificado.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnularOpen(false)}
              disabled={pending}
            >
              Volver
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmarAnular}>
              {pending ? "Anulando…" : "Anular plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
