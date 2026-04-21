"use client";

import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
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

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
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
  const selected = parseYmd(value);

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
          mode="single"
          captionLayout="dropdown"
          fromYear={2000}
          toYear={new Date().getFullYear() + 1}
          defaultMonth={selected}
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
