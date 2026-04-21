"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Calendar date in the user's locale (avoids UTC shift from `parseISO("yyyy-MM-dd")`). */
function parseYmdLocal(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) {
    return undefined;
  }
  return d;
}

function ymdFromDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's date as `yyyy-MM-dd` in the browser's local timezone. */
export function todayLocalYmd(): string {
  return ymdFromDateLocal(new Date());
}

export type DatePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder = "Elegir fecha…",
  disabled,
  className,
  triggerClassName,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseYmdLocal(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "min-h-12 w-full justify-start gap-2 rounded-2xl border-border/70 bg-background/80 px-4 text-left text-base font-normal shadow-none hover:bg-muted/60",
            !selected && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          {selected ? (
            format(selected, "d MMM yyyy", { locale: es })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          key={value}
          mode="single"
          captionLayout="dropdown"
          fromYear={2000}
          toYear={new Date().getFullYear() + 1}
          defaultMonth={selected}
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(ymdFromDateLocal(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
