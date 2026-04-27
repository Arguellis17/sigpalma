import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/** Fecha/hora estable SSR + cliente (evita diferencias de `Intl` Node vs navegador). */
export function formatTableDateTimeCo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return String(iso);
    return format(d, "dd/MM/yyyy, HH:mm", { locale: es });
  } catch {
    return String(iso);
  }
}

export function formatDialogDateTimeFullCo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return String(iso);
    return format(d, "PPPPp", { locale: es });
  } catch {
    return String(iso);
  }
}
