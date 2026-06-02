import { endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Views, type View } from "react-big-calendar";

import type { LaborAgendaRow } from "@/app/actions/queries";

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: LaborAgendaRow;
};

export const LABORES_CALENDAR_MESSAGES = {
  allDay: "Todo el día",
  previous: "Anterior",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Labor",
  showMore: (n: number) => `+${n} más`,
  noEventsInRange: "No hay labores en este rango.",
};

export function rowsToEvents(rows: LaborAgendaRow[]): CalendarEvent[] {
  return rows.map((row) => {
    const dayStart = parseISO(`${row.fecha_ejecucion}T00:00:00`);
    const dayEnd = parseISO(`${row.fecha_ejecucion}T23:59:59`);
    return {
      id: row.id,
      title: `${row.tipo} · ${row.lote_codigo}`,
      start: dayStart,
      end: dayEnd,
      allDay: true,
      resource: row,
    };
  });
}

export function rangeForView(view: View, date: Date): { desde: string; hasta: string } {
  if (view === Views.MONTH) {
    return {
      desde: format(startOfMonth(date), "yyyy-MM-dd"),
      hasta: format(endOfMonth(date), "yyyy-MM-dd"),
    };
  }
  if (view === Views.WEEK) {
    const wkStart = startOfWeek(date, { locale: es });
    const wkEnd = endOfWeek(date, { locale: es });
    return {
      desde: format(wkStart, "yyyy-MM-dd"),
      hasta: format(wkEnd, "yyyy-MM-dd"),
    };
  }
  if (view === Views.DAY) {
    const ymd = format(date, "yyyy-MM-dd");
    return { desde: ymd, hasta: ymd };
  }
  return {
    desde: format(startOfMonth(date), "yyyy-MM-dd"),
    hasta: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function tecnicoEventClassName(): string {
  return "!bg-primary/15 !text-foreground ring-1 ring-primary/25 rounded-md text-xs";
}

export function operarioEventClassName(row: LaborAgendaRow): string {
  if (row.pendiente_ejecucion) {
    return "!bg-amber-500/15 !text-foreground ring-1 ring-amber-500/30 rounded-md text-xs";
  }
  return "!bg-muted/40 !text-muted-foreground ring-1 ring-border/60 rounded-md text-xs";
}

export function operarioGanttBarClassName(row: LaborAgendaRow): string {
  if (row.pendiente_ejecucion) {
    return "truncate rounded bg-amber-500/15 px-0.5 py-0.5 text-left text-[10px] leading-tight ring-1 ring-amber-500/25 hover:bg-amber-500/25";
  }
  return "truncate rounded bg-muted/40 px-0.5 py-0.5 text-left text-[10px] leading-tight text-muted-foreground ring-1 ring-border/50 hover:bg-muted/60";
}
