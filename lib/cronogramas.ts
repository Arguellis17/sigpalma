/**
 * Regla de recurrencia de los cronogramas de labores (CR-05). Es espejo de la función SQL
 * `cronograma_aplica`, que es la que genera las labores; aquí se usa para mostrar las próximas fechas.
 */
export const FRECUENCIAS_CRONOGRAMA = ["diaria", "semanal", "mensual"] as const;
export type FrecuenciaCronograma = (typeof FRECUENCIAS_CRONOGRAMA)[number];

export type ReglaCronograma = {
  frecuencia: FrecuenciaCronograma;
  intervalo: number;
  /** ISO: 1 = lunes … 7 = domingo. Solo semanal. */
  dias_semana: number[];
  fecha_inicio: string;
  fecha_fin?: string | null;
};

export const DIAS_SEMANA = [
  { valor: 1, corto: "L", nombre: "lunes" },
  { valor: 2, corto: "M", nombre: "martes" },
  { valor: 3, corto: "X", nombre: "miércoles" },
  { valor: 4, corto: "J", nombre: "jueves" },
  { valor: 5, corto: "V", nombre: "viernes" },
  { valor: 6, corto: "S", nombre: "sábado" },
  { valor: 7, corto: "D", nombre: "domingo" },
] as const;

const MS_DIA = 86_400_000;
const aFecha = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const aYmd = (d: Date) => d.toISOString().slice(0, 10);
const diaIso = (d: Date) => d.getUTCDay() || 7;

function aplica(regla: ReglaCronograma, fecha: Date): boolean {
  const inicio = aFecha(regla.fecha_inicio);
  if (fecha < inicio) return false;

  if (regla.frecuencia === "diaria") {
    return Math.round((fecha.getTime() - inicio.getTime()) / MS_DIA) % regla.intervalo === 0;
  }

  if (regla.frecuencia === "semanal") {
    const lunesInicio = inicio.getTime() - (diaIso(inicio) - 1) * MS_DIA;
    const semanas = Math.floor(Math.round((fecha.getTime() - lunesInicio) / MS_DIA) / 7);
    return regla.dias_semana.includes(diaIso(fecha)) && semanas % regla.intervalo === 0;
  }

  // Mensual: mismo día del mes que el inicio; si el mes es más corto, su último día.
  const meses =
    (fecha.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + fecha.getUTCMonth() - inicio.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)).getUTCDate();
  return meses % regla.intervalo === 0 && fecha.getUTCDate() === Math.min(inicio.getUTCDate(), ultimoDia);
}

/** Próximas fechas de la regla a partir de `desde` (incluida). */
export function proximasFechas(regla: ReglaCronograma, desde: string, cantidad = 5): string[] {
  const fechas: string[] = [];
  const fin = regla.fecha_fin ? aFecha(regla.fecha_fin).getTime() : Infinity;
  let t = Math.max(aFecha(desde).getTime(), aFecha(regla.fecha_inicio).getTime());
  // Tope de búsqueda: 1600 días cubren la regla más espaciada (cada 52 meses).
  const tope = t + 1600 * MS_DIA;
  while (fechas.length < cantidad && t <= fin && t <= tope) {
    const d = new Date(t);
    if (aplica(regla, d)) fechas.push(aYmd(d));
    t += MS_DIA;
  }
  return fechas;
}

/** "Cada 2 semanas: lunes, jueves". */
export function describirRegla(regla: Pick<ReglaCronograma, "frecuencia" | "intervalo" | "dias_semana" | "fecha_inicio">): string {
  const n = regla.intervalo;
  if (regla.frecuencia === "diaria") return n === 1 ? "Todos los días" : `Cada ${n} días`;
  if (regla.frecuencia === "semanal") {
    const dias = DIAS_SEMANA.filter((d) => regla.dias_semana.includes(d.valor)).map((d) => d.nombre).join(", ");
    return `${n === 1 ? "Cada semana" : `Cada ${n} semanas`}: ${dias}`;
  }
  const dia = Number(regla.fecha_inicio.slice(8, 10));
  return `${n === 1 ? "Cada mes" : `Cada ${n} meses`}, el día ${dia}`;
}
