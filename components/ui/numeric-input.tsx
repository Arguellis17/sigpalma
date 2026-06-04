"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  normalizeNumericInputOnBlur,
  sanitizeNumericInput,
} from "@/lib/numeric-input";

export type NumericInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Solo dígitos (sin decimales). */
  integer?: boolean;
};

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  function NumericInput(
    { value, onValueChange, integer = false, className, onBlur, ...props },
    ref
  ) {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          const next = sanitizeNumericInput(e.target.value, { integer });
          if (next !== null) onValueChange(next);
        }}
        onBlur={(e) => {
          const normalized = normalizeNumericInputOnBlur(e.target.value);
          if (normalized !== e.target.value) {
            onValueChange(normalized);
          }
          onBlur?.(e);
        }}
        className={cn(className)}
        {...props}
      />
    );
  }
);

/** Campo numérico no controlado (FormData / name=). */
export type NumericInputUncontrolledProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode"
> & {
  integer?: boolean;
};

export function NumericInputUncontrolled({
  integer = false,
  className,
  onBlur,
  ...props
}: NumericInputUncontrolledProps) {
  return (
    <Input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      className={cn(className)}
      onBlur={onBlur}
      {...props}
    />
  );
}
