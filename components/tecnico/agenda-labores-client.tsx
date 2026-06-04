"use client";

import { useCallback, useMemo, useState } from "react";
import { addMonths, format, subMonths } from "date-fns";
import { Views, type SlotInfo, type View } from "react-big-calendar";

import { actualizarLabor, registrarLabor } from "@/app/actions/labores";
import { getLaboresRango } from "@/app/actions/queries";
import type {
  CatalogoLaborOption,
  LaborAgendaRow,
  LoteOption,
  OperarioFincaOption,
} from "@/app/actions/queries";
import {
  LaboresBigCalendar,
  type CalendarEvent,
} from "@/components/labores/labores-big-calendar";
import { LaboresGanttChart } from "@/components/labores/labores-gantt-chart";
import { LaboresScheduleToolbar } from "@/components/labores/labores-schedule-toolbar";
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
import { cn } from "@/lib/utils";
import { rangeForView, rowsToEvents, tecnicoEventClassName } from "@/lib/labores-schedule";
import { useToast } from "@/components/ui/toast";

type Props = {
  fincaId: string;
  catalogoLabores: CatalogoLaborOption[];
  lotes: LoteOption[];
  operarios: OperarioFincaOption[];
  initialLabores: LaborAgendaRow[];
};

const IDLE_LOTE = "__lote_idle__";
const IDLE_CAT = "__cat_idle__";
const IDLE_OPERARIO = "__operario_idle__";

export function AgendaLaboresClient({
  fincaId,
  catalogoLabores,
  lotes,
  operarios,
  initialLabores,
}: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<LaborAgendaRow[]>(initialLabores);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [loadingRange, setLoadingRange] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loteId, setLoteId] = useState("");
  const [catalogoId, setCatalogoId] = useState("");
  const [fechaYmd, setFechaYmd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notas, setNotas] = useState("");
  const [assignedTo, setAssignedTo] = useState(IDLE_OPERARIO);
  const [pending, setPending] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"calendar" | "gantt">("calendar");

  const events = useMemo(() => rowsToEvents(rows), [rows]);

  const reloadRange = useCallback(
    async (view: View, date: Date) => {
      const { desde, hasta } = rangeForView(view, date);
      setLoadingRange(true);
      const res = await getLaboresRango(fincaId, desde, hasta);
      setLoadingRange(false);
      if (!res.success) {
        toast(`No se pudo cargar el calendario: ${res.error}`, "error");
        return;
      }
      setRows(res.data);
    },
    [fincaId, toast]
  );

  const handleNavigate = useCallback(
    (newDate: Date) => {
      setCalendarDate(newDate);
      void reloadRange(currentView, newDate);
    },
    [currentView, reloadRange]
  );

  const handleViewChange = useCallback(
    (view: View) => {
      setCurrentView(view);
      void reloadRange(view, calendarDate);
    },
    [calendarDate, reloadRange]
  );

  function openCreate(slot: SlotInfo) {
    setEditingId(null);
    const d = slot.start ?? calendarDate;
    setFechaYmd(format(d, "yyyy-MM-dd"));
    setLoteId(lotes[0]?.id ?? IDLE_LOTE);
    setCatalogoId(catalogoLabores[0]?.id ?? IDLE_CAT);
    setAssignedTo(operarios[0]?.id ?? IDLE_OPERARIO);
    setNotas("");
    setDialogOpen(true);
  }

  function openEditFromRow(r: LaborAgendaRow) {
    setEditingId(r.id);
    setLoteId(r.lote_id);
    const matchId =
      (r.catalogo_item_id &&
      catalogoLabores.some((c) => c.id === r.catalogo_item_id)
        ? r.catalogo_item_id
        : catalogoLabores.find(
            (c) => c.nombre.trim().toLowerCase() === r.tipo.trim().toLowerCase()
          )?.id) ??
      catalogoLabores[0]?.id ??
      IDLE_CAT;
    setCatalogoId(matchId);
    setFechaYmd(r.fecha_ejecucion);
    setNotas(r.notas ?? "");
    setAssignedTo(r.assigned_to ?? IDLE_OPERARIO);
    setDialogOpen(true);
  }

  function openEdit(ev: CalendarEvent) {
    openEditFromRow(ev.resource);
  }

  function shiftGanttMonth(delta: number) {
    const d = delta < 0 ? subMonths(calendarDate, 1) : addMonths(calendarDate, 1);
    setCalendarDate(d);
    void reloadRange(Views.MONTH, d);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loteId || loteId === IDLE_LOTE) {
      toast("Seleccione un lote.", "error");
      return;
    }
    if (!catalogoId || catalogoId === IDLE_CAT) {
      toast("Seleccione el tipo de labor del catálogo.", "error");
      return;
    }
    const catRow = catalogoLabores.find((c) => c.id === catalogoId);
    if (!catRow) {
      toast("Catálogo inválido.", "error");
      return;
    }
    if (!assignedTo || assignedTo === IDLE_OPERARIO) {
      toast("Seleccione el operario asignado.", "error");
      return;
    }
    const opRow = operarios.find((o) => o.id === assignedTo);

    setPending(true);
    if (editingId) {
      const result = await actualizarLabor({
        id: editingId,
        lote_id: loteId,
        tipo: catRow.nombre,
        fecha_ejecucion: fechaYmd,
        notas: notas.trim() || null,
        catalogo_item_id: catalogoId,
        assigned_to: assignedTo,
      });
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast("Labor actualizada. Los cambios quedaron registrados.");
    } else {
      const result = await registrarLabor({
        finca_id: fincaId,
        lote_id: loteId,
        tipo: catRow.nombre,
        fecha_ejecucion: fechaYmd,
        notas: notas.trim() || null,
        source: "web",
        catalogo_item_id: catalogoId,
        assigned_to: assignedTo,
      });
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast(
        opRow
          ? `Labor programada para ${opRow.full_name || "operario"}.`
          : "Labor programada."
      );
    }

    setDialogOpen(false);
    await reloadRange(currentView, calendarDate);
  }

  if (lotes.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        No hay lotes activos en su finca. Revise la gestión de lotes antes de programar labores.
      </p>
    );
  }

  if (catalogoLabores.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        El catálogo de tipos de labor está vacío o inactivo. Un administrador debe cargar ítems en
        Catálogos → Labores agronómicas.
      </p>
    );
  }

  if (operarios.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        No hay operarios activos en esta finca. Cree usuarios operario asignados a la finca antes de
        programar labores.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <LaboresScheduleToolbar
        layoutMode={layoutMode}
        onCalendar={() => setLayoutMode("calendar")}
        onGantt={() => {
          setLayoutMode("gantt");
          setCurrentView(Views.MONTH);
          void reloadRange(Views.MONTH, calendarDate);
        }}
      />

      {layoutMode === "gantt" ? (
        <div className={cn(loadingRange && "opacity-70")}>
          <LaboresGanttChart
            calendarDate={calendarDate}
            lotes={lotes}
            labores={rows}
            onPrevMonth={() => shiftGanttMonth(-1)}
            onNextMonth={() => shiftGanttMonth(1)}
            onSelectLabor={openEditFromRow}
            emptyMessage="No hay labores programadas en este mes."
            hint="Barras por lote y día. Mismos datos que la agenda; pulse una barra para editar."
            getBarClassName={() =>
              "truncate rounded bg-primary/15 px-0.5 py-0.5 text-left text-[10px] leading-tight ring-1 ring-primary/20 hover:bg-primary/25"
            }
          />
        </div>
      ) : (
        <LaboresBigCalendar
          events={events}
          currentView={currentView}
          calendarDate={calendarDate}
          loading={loadingRange}
          onNavigate={handleNavigate}
          onViewChange={handleViewChange}
          onSelectSlot={openCreate}
          onSelectEvent={openEdit}
          eventPropGetter={() => ({ className: tecnicoEventClassName() })}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modificar labor programada" : "Nueva labor programada"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Lote</Label>
                <Select value={loteId || IDLE_LOTE} onValueChange={setLoteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipo de labor (catálogo)</Label>
                <Select value={catalogoId || IDLE_CAT} onValueChange={setCatalogoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogoLabores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fecha programada</Label>
                <DatePickerField value={fechaYmd} onChange={setFechaYmd} />
              </div>
              <div className="grid gap-2">
                <Label>Operario asignado</Label>
                <Select
                  value={assignedTo || IDLE_OPERARIO}
                  onValueChange={setAssignedTo}
                >
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
              <div className="grid gap-2">
                <Label htmlFor="notas-agenda">Notas (opcional)</Label>
                <Textarea
                  id="notas-agenda"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  className="resize-none rounded-xl"
                  placeholder="Observaciones para operador de campo…"
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
                {pending ? "Guardando…" : editingId ? "Guardar cambios" : "Programar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
