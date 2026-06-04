"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { addMonths, format, subMonths } from "date-fns";
import { Views, type SlotInfo, type View } from "react-big-calendar";

import { getLaboresRango } from "@/app/actions/queries";
import type { LaborAgendaRow, LoteOption } from "@/app/actions/queries";
import { LaboresGanttChart } from "@/components/labores/labores-gantt-chart";
import { LaboresScheduleToolbar } from "@/components/labores/labores-schedule-toolbar";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { cn } from "@/lib/utils";
import {
  operarioEventClassName,
  operarioGanttBarClassName,
  rangeForView,
  rowsToEvents,
} from "@/lib/labores-schedule";
import { useToast } from "@/components/ui/toast";
import type { CalendarEvent } from "@/components/labores/labores-big-calendar";

const LaboresBigCalendar = dynamic(
  () =>
    import("@/components/labores/labores-big-calendar").then((m) => m.LaboresBigCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="surface-panel flex min-h-[320px] items-center justify-center rounded-[1.25rem] ring-1 ring-border/60">
        <p className="text-sm text-muted-foreground">Cargando calendario…</p>
      </div>
    ),
  }
);

type Props = {
  fincaId: string;
  operarioId: string | null;
  lotes: LoteOption[];
  initialLabores: LaborAgendaRow[];
  onOpenCreate: (opts: { fecha?: string; pendienteId?: string }) => void;
  onViewExecuted: (row: LaborAgendaRow) => void;
  onReload?: () => void;
};

export function LaboresOperarioSchedule({
  fincaId,
  operarioId,
  lotes,
  initialLabores,
  onOpenCreate,
  onViewExecuted,
}: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useServerPropsState(initialLabores);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [loadingRange, setLoadingRange] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"calendar" | "gantt">("calendar");

  const events = useMemo(() => rowsToEvents(rows), [rows]);

  const reloadRange = useCallback(
    async (view: View, date: Date) => {
      const { desde, hasta } = rangeForView(view, date);
      setLoadingRange(true);
      const res = await getLaboresRango(
        fincaId,
        desde,
        hasta,
        operarioId ? { operarioId } : undefined
      );
      setLoadingRange(false);
      if (!res.success) {
        toast(`No se pudo cargar el calendario: ${res.error}`, "error");
        return;
      }
      setRows(res.data);
    },
    [fincaId, operarioId, setRows, toast]
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

  function handleSelectSlot(slot: SlotInfo) {
    const d = slot.start ?? calendarDate;
    onOpenCreate({ fecha: format(d, "yyyy-MM-dd") });
  }

  function handleSelectLabor(row: LaborAgendaRow) {
    if (row.pendiente_ejecucion) {
      onOpenCreate({ pendienteId: row.id, fecha: row.fecha_ejecucion });
      return;
    }
    onViewExecuted(row);
  }

  function handleSelectEvent(ev: CalendarEvent) {
    handleSelectLabor(ev.resource);
  }

  function shiftGanttMonth(delta: number) {
    const d = delta < 0 ? subMonths(calendarDate, 1) : addMonths(calendarDate, 1);
    setCalendarDate(d);
    void reloadRange(Views.MONTH, d);
  }

  if (lotes.length === 0) {
    return (
      <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
        No hay lotes en su finca para mostrar la agenda.
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
            onSelectLabor={handleSelectLabor}
            emptyMessage="No hay labores en este mes."
            hint="Barras por lote y día. Pulse una barra para reportar o ver detalle."
            getBarClassName={operarioGanttBarClassName}
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
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={(event) => ({
            className: operarioEventClassName(event.resource),
          })}
        />
      )}

      <p className="text-xs text-muted-foreground">
        <span className="inline-block size-2 rounded-sm bg-amber-500/40 ring-1 ring-amber-500/30" />{" "}
        Ámbar = pendiente de reportar ejecución (clic para abrir formulario) ·{" "}
        <span className="inline-block size-2 rounded-sm bg-muted/60 ring-1 ring-border/60" /> Gris =
        ya ejecutada (solo detalle)
      </p>
    </div>
  );
}

export type { LaborAgendaRow };
