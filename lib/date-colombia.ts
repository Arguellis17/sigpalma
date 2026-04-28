/**
 * Fecha civil actual en zona America/Bogota (YYYY-MM-DD).
 * Usada para RN31 (programación de labores sin fechas pasadas).
 */
export function todayColombiaYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
