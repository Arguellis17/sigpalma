"use client";

import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

import type { LaborAgendaRow, LoteOption } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { operarioGanttBarClassName } from "@/lib/labores-schedule";

type Props = {
  calendarDate: Date;
  lotes: LoteOption[];
  labores: LaborAgendaRow[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectLabor: (row: LaborAgendaRow) => void;
  emptyMessage?: string;
  hint?: string;
  getBarClassName?: (row: LaborAgendaRow) => string;
};

export function LaboresGanttChart({
  calendarDate,
  lotes,
  labores,
  onPrevMonth,
  onNextMonth,
  onSelectLabor,
  emptyMessage = "No hay labores programadas en este mes.",
  hint = "Barras por lote y día. Pulse una barra para ver o editar.",
  getBarClassName,
}: Props) {
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const desde = format(monthStart, "yyyy-MM-dd");
  const hasta = format(monthEnd, "yyyy-MM-dd");
  const inMonth = labores.filter(
    (r) => r.fecha_ejecucion >= desde && r.fecha_ejecucion <= hasta
  );
  const loteIdsUsed = [...new Set(inMonth.map((r) => r.lote_id))];
  const rowLotes = lotes
    .filter((l) => loteIdsUsed.includes(l.id))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const barClass = getBarClassName ?? operarioGanttBarClassName;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPrevMonth}>
            ← Mes anterior
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium capitalize">
            {format(calendarDate, "MMMM yyyy", { locale: es })}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onNextMonth}>
            Mes siguiente →
          </Button>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="overflow-x-auto rounded-[1.25rem] ring-1 ring-border/60">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 px-2 py-2 text-left font-medium text-muted-foreground">
                Lote
              </th>
              {days.map((d) => (
                <th
                  key={d.toISOString()}
                  className="min-w-[26px] px-0.5 py-2 text-center font-normal text-muted-foreground"
                >
                  {format(d, "d")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLotes.map((lote) => (
              <tr key={lote.id} className="border-b border-border/40">
                <td className="sticky left-0 z-10 bg-background px-2 py-1 font-medium">
                  {lote.codigo}
                </td>
                {days.map((d) => {
                  const ymd = format(d, "yyyy-MM-dd");
                  const cell = inMonth.filter(
                    (r) => r.lote_id === lote.id && r.fecha_ejecucion === ymd
                  );
                  return (
                    <td key={ymd} className="align-top p-0.5">
                      <div className="flex min-h-[36px] flex-col gap-0.5">
                        {cell.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => onSelectLabor(r)}
                            className={barClass(r)}
                            title={r.tipo}
                          >
                            {r.tipo.length > 12 ? `${r.tipo.slice(0, 12)}…` : r.tipo}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rowLotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
