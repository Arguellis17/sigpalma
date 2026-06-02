"use client";

import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type EventPropGetter,
  type SlotInfo,
  type View,
} from "react-big-calendar";
import { format, getDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/app/labores-big-calendar.css";

import type { LaborAgendaRow } from "@/app/actions/queries";
import { cn } from "@/lib/utils";
import {
  LABORES_CALENDAR_MESSAGES,
  type CalendarEvent,
} from "@/lib/labores-schedule";

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  startOfWeek,
  getDay,
  locales,
});

type Props = {
  events: CalendarEvent[];
  currentView: View;
  calendarDate: Date;
  loading?: boolean;
  onNavigate: (date: Date) => void;
  onViewChange: (view: View) => void;
  onSelectSlot: (slot: SlotInfo) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  eventPropGetter?: EventPropGetter<CalendarEvent>;
};

export function LaboresBigCalendar({
  events,
  currentView,
  calendarDate,
  loading,
  onNavigate,
  onViewChange,
  onSelectSlot,
  onSelectEvent,
  eventPropGetter,
}: Props) {
  return (
    <div
      className={cn(
        "rbc-wrapper surface-panel overflow-hidden rounded-[1.25rem] ring-1 ring-border/60",
        loading && "opacity-70"
      )}
    >
      <Calendar
        culture="es"
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ minHeight: "min(70vh, 640px)" }}
        views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
        view={currentView}
        date={calendarDate}
        onNavigate={onNavigate}
        onView={onViewChange}
        messages={LABORES_CALENDAR_MESSAGES}
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={(ev) => onSelectEvent(ev as CalendarEvent)}
        eventPropGetter={
          eventPropGetter ??
          (() => ({
            className:
              "!bg-primary/15 !text-foreground ring-1 ring-primary/25 rounded-md text-xs",
          }))
        }
      />
    </div>
  );
}

export type { CalendarEvent, SlotInfo, View };
export { Views };

export function defaultTecnicoEventPropGetter(): EventPropGetter<CalendarEvent> {
  return () => ({
    className: "!bg-primary/15 !text-foreground ring-1 ring-primary/25 rounded-md text-xs",
  });
}

export function operarioEventPropGetter(
  event: CalendarEvent
): { className: string } {
  const row = event.resource as LaborAgendaRow;
  if (row.pendiente_ejecucion) {
    return {
      className:
        "!bg-amber-500/15 !text-foreground ring-1 ring-amber-500/30 rounded-md text-xs",
    };
  }
  return {
    className:
      "!bg-muted/40 !text-muted-foreground ring-1 ring-border/60 rounded-md text-xs",
  };
}
