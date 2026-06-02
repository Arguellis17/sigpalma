"use client";

import { Button } from "@/components/ui/button";

type LayoutMode = "calendar" | "gantt";

type Props = {
  layoutMode: LayoutMode;
  onCalendar: () => void;
  onGantt: () => void;
  ganttHint?: string;
};

export function LaboresScheduleToolbar({
  layoutMode,
  onCalendar,
  onGantt,
  ganttHint,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={layoutMode === "calendar" ? "default" : "outline"}
        size="sm"
        className="rounded-xl"
        onClick={onCalendar}
      >
        Calendario
      </Button>
      <Button
        type="button"
        variant={layoutMode === "gantt" ? "default" : "outline"}
        size="sm"
        className="rounded-xl"
        onClick={onGantt}
      >
        Vista Gantt
      </Button>
      {ganttHint ? (
        <p className="max-w-md text-xs text-muted-foreground">{ganttHint}</p>
      ) : null}
    </div>
  );
}
