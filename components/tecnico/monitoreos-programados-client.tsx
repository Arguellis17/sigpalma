"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actualizarMonitoreoProgramado,
  anularMonitoreoProgramado,
  crearMonitoreoProgramado,
} from "@/app/actions/monitoreo-programado";
import {
  getMonitoreosFitosanitariosRango,
  type LoteOption,
  type MonitoreoProgramadoRow,
  type OperarioFincaOption,
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
import { useToast } from "@/components/ui/toast";
import { todayColombiaYmd } from "@/lib/date-colombia";

type Props = {
  fincaId: string;
  lotesActivos: LoteOption[];
  operarios: OperarioFincaOption[];
  /** Primer día del mes mostrado inicialmente (AAAA-MM-01), alineado a Colombia en el servidor. */
  mesInicialDesde: string;
  monitoreosIniciales: MonitoreoProgramadoRow[];
};

function parseYmd(s: string): { y: number; m0: number } {
  const [ys, ms] = s.split("-");
  return { y: Number(ys), m0: Number(ms) - 1 };
}

/** Primer y último día del mes civil (y, monthIndex 0–11) como YYYY-MM-DD. */
function monthRange(y: number, monthIndex0: number): { desde: string; hasta: string } {
  const m = monthIndex0 + 1;
  const desde = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, monthIndex0 + 1, 0).getDate();
  const hasta = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { desde, hasta };
}

function labelMes(y: number, monthIndex0: number): string {
  const d = new Date(y, monthIndex0, 1);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

export function MonitoreosProgramadosClient({
  fincaId,
  lotesActivos,
  operarios,
  mesInicialDesde,
  monitoreosIniciales,
}: Props) {
  const { toast } = useToast();
  const [{ y, m0 }, setYm] = useState(() => parseYmd(mesInicialDesde.slice(0, 7) + "-01"));
  const [rows, setRows] = useState<MonitoreoProgramadoRow[]>(monitoreosIniciales);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [anularId, setAnularId] = useState<string | null>(null);

  const [loteId, setLoteId] = useState(lotesActivos[0]?.id ?? "");
  const [fechaInspeccion, setFechaInspeccion] = useState(todayColombiaYmd());
  const [assignedTo, setAssignedTo] = useState(operarios[0]?.id ?? "");
  const [notas, setNotas] = useState("");

  const { desde, hasta } = useMemo(() => monthRange(y, m0), [y, m0]);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await getMonitoreosFitosanitariosRango(fincaId, desde, hasta);
    setLoading(false);
    if (!r.success) {
      toast(r.error, "error");
      return;
    }
    setRows(r.data);
  }, [fincaId, desde, hasta, toast]);

  const skipFirstRangeEffect = useRef(true);
  useEffect(() => {
    if (skipFirstRangeEffect.current) {
      skipFirstRangeEffect.current = false;
      return;
    }
    void reload();
  }, [desde, hasta, reload]);

  const hayLotes = lotesActivos.length > 0;
  const hayOperarios = operarios.length > 0;

  function openCreate() {
    setEditingId(null);
    setLoteId(lotesActivos[0]?.id ?? "");
    setFechaInspeccion(todayColombiaYmd());
    setAssignedTo(operarios[0]?.id ?? "");
    setNotas("");
    setDialogOpen(true);
  }

  function openEdit(row: MonitoreoProgramadoRow) {
    if (row.is_voided || row.estado !== "pendiente") {
      toast("Solo puede editar programaciones pendientes y no anuladas.", "error");
      return;
    }
    setEditingId(row.id);
    setLoteId(row.lote_id);
    setFechaInspeccion(row.fecha_inspeccion);
    setAssignedTo(row.assigned_to);
    setNotas(row.notas ?? "");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loteId || !assignedTo || !fechaInspeccion) {
      toast("Complete lote, fecha y operario.", "error");
      return;
    }
    setPending(true);
    try {
      if (editingId) {
        const res = await actualizarMonitoreoProgramado({
          id: editingId,
          finca_id: fincaId,
          lote_id: loteId,
          fecha_inspeccion: fechaInspeccion,
          assigned_to: assignedTo,
          notas: notas.trim() ? notas.trim() : null,
        });
        if (!res.success) {
          toast(res.error, "error");
          return;
        }
        toast("Programación actualizada.", "success");
      } else {
        const res = await crearMonitoreoProgramado({
          finca_id: fincaId,
          lote_id: loteId,
          fecha_inspeccion: fechaInspeccion,
          assigned_to: assignedTo,
          notas: notas.trim() ? notas.trim() : null,
        });
        if (!res.success) {
          toast(res.error, "error");
          return;
        }
        toast("Programación creada. El operario la verá en su bandeja.", "success");
      }
      setDialogOpen(false);
      setEditingId(null);
      await reload();
    } finally {
      setPending(false);
    }
  }

  async function confirmAnular() {
    if (!anularId) return;
    setPending(true);
    try {
      const res = await anularMonitoreoProgramado({ id: anularId });
      if (!res.success) {
        toast(res.error, "error");
        return;
      }
      toast("Programación anulada.", "success");
      setAnularId(null);
      await reload();
    } finally {
      setPending(false);
    }
  }

  function prevMonth() {
    setYm(({ y: yy, m0: m }) => {
      if (m === 0) return { y: yy - 1, m0: 11 };
      return { y: yy, m0: m - 1 };
    });
  }

  function nextMonth() {
    setYm(({ y: yy, m0: m }) => {
      if (m === 11) return { y: yy + 1, m0: 0 };
      return { y: yy, m0: m + 1 };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={prevMonth}>
            Mes anterior
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium capitalize">
            {labelMes(y, m0)}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={nextMonth}>
            Mes siguiente
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => void reload()}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </Button>
        </div>
        <Button type="button" onClick={openCreate} disabled={!hayLotes || !hayOperarios}>
          Nueva programación
        </Button>
      </div>

      {!hayLotes || !hayOperarios ? (
        <p className="text-sm text-muted-foreground">
          {!hayLotes ? "No hay lotes activos para programar. " : ""}
          {!hayOperarios
            ? "No hay operarios activos en esta finca; cree usuarios operario asignados a la finca."
            : ""}
        </p>
      ) : null}

      <div className="surface-panel overflow-x-auto rounded-[1.5rem]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 text-muted-foreground">
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Lote</th>
              <th className="p-3 font-medium">Operario</th>
              <th className="p-3 font-medium">Estado</th>
              <th className="p-3 font-medium">Notas</th>
              <th className="p-3 font-medium w-[1%]" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No hay programaciones en este mes. Use «Nueva programación» o cambie de mes.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 whitespace-nowrap">{row.fecha_inspeccion}</td>
                  <td className="p-3">{row.lote_codigo}</td>
                  <td className="p-3">{row.asignado_nombre}</td>
                  <td className="p-3">
                    {row.is_voided || row.estado === "anulada"
                      ? "Anulada"
                      : row.estado === "completada"
                        ? "Completada"
                        : "Pendiente"}
                  </td>
                  <td className="p-3 max-w-[240px] truncate" title={row.notas ?? undefined}>
                    {row.notas ?? "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap text-right">
                    {!row.is_voided && row.estado === "pendiente" ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(row)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setAnularId(row.id)}
                        >
                          Anular
                        </Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(anularId)} onOpenChange={(o) => !o && setAnularId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular programación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La inspección dejará de aparecer como pendiente para el operario.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAnularId(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmAnular}>
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar programación" : "Nueva inspección programada"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Lote</Label>
              <Select value={loteId} onValueChange={setLoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotesActivos.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha-inspeccion-mip">Fecha de inspección</Label>
              <DatePickerField
                id="fecha-inspeccion-mip"
                value={fechaInspeccion}
                onChange={setFechaInspeccion}
              />
            </div>
            <div className="space-y-2">
              <Label>Operario asignado</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione operario" />
                </SelectTrigger>
                <SelectContent>
                  {operarios.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name || "Operario"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : editingId ? "Guardar" : "Programar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
