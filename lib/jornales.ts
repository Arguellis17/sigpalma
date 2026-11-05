/** Consolidación de la liquidación de jornales (CR-06). El cálculo por labor lo hace la base de datos. */

/** Formas de pago: por labor (palma, hectárea, día) o por lo cosechado (kilo, racimo). */
export const UNIDADES_PAGO_LABOR = ["palmas", "ha", "jornal"] as const;
export const UNIDADES_PAGO_COSECHA = ["kg", "racimo"] as const;
export const UNIDADES_PAGO = [...UNIDADES_PAGO_LABOR, ...UNIDADES_PAGO_COSECHA] as const;
export type UnidadPago = (typeof UNIDADES_PAGO)[number];

const ETIQUETA_UNIDAD: Record<UnidadPago, { singular: string; plural: string; tarifa: string }> = {
  palmas: { singular: "palma", plural: "palmas", tarifa: "Por palma" },
  ha: { singular: "hectárea", plural: "hectáreas", tarifa: "Por hectárea" },
  jornal: { singular: "jornal", plural: "jornales", tarifa: "Por jornal (día trabajado)" },
  kg: { singular: "kg", plural: "kg", tarifa: "Por kilo cosechado" },
  racimo: { singular: "racimo", plural: "racimos", tarifa: "Por racimo cosechado" },
};

export function labelTarifa(unidad: string): string {
  return ETIQUETA_UNIDAD[unidad as UnidadPago]?.tarifa ?? unidad;
}

export function labelUnidadPago(unidad: string): string {
  return ETIQUETA_UNIDAD[unidad as UnidadPago]?.plural ?? unidad;
}

/** "10 palmas", "1 jornal", "500 kg"; un jornal en 0 es una labor más del mismo día ya pagado. */
export function formatCantidadPago(cantidad: number, unidad: string): string {
  if (unidad === "jornal" && cantidad === 0) return "Incluida en el jornal del día";
  const e = ETIQUETA_UNIDAD[unidad as UnidadPago];
  const n = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toLocaleString("es-CO", { maximumFractionDigits: 3 });
  if (!e) return `${n} ${unidad}`;
  return `${n} ${cantidad === 1 ? e.singular : e.plural}`;
}

/** Nombre de la tarifa de cosecha, que no depende de una labor del catálogo. */
export const NOMBRE_TARIFA_COSECHA = "Cosecha RFF (lo cosechado)";

export type FilaLiquidacion = {
  /** Una fila es una labor ejecutada o una cosecha (exactamente uno de los dos). */
  labor_id: string | null;
  cosecha_id?: string | null;
  trabajador_id: string;
  trabajador_nombre: string;
  trabajador_documento: string | null;
  catalogo_item_id?: string | null;
  labor_nombre: string;
  lote_codigo: string;
  fecha: string;
  cantidad: number;
  unidad_medida: string;
  /** null = no hay tarifa vigente para esa labor, unidad y fecha. */
  valor_unitario: number | null;
  subtotal: number | null;
};

export type TotalTrabajador = {
  trabajador_id: string;
  trabajador_nombre: string;
  trabajador_documento: string | null;
  labores: number;
  sin_tarifa: number;
  total: number;
  filas: FilaLiquidacion[];
};

const centavos = (n: number) => Math.round(n * 100);

export const idFila = (f: Pick<FilaLiquidacion, "labor_id" | "cosecha_id">) => f.labor_id ?? f.cosecha_id ?? "";

/** Agrupa por trabajador. Suma en centavos para no acumular error de punto flotante. */
export function consolidarPorTrabajador(filas: FilaLiquidacion[]): TotalTrabajador[] {
  const grupos = new Map<string, TotalTrabajador>();
  for (const f of filas) {
    const g =
      grupos.get(f.trabajador_id) ??
      {
        trabajador_id: f.trabajador_id,
        trabajador_nombre: f.trabajador_nombre,
        trabajador_documento: f.trabajador_documento,
        labores: 0,
        sin_tarifa: 0,
        total: 0,
        filas: [],
      };
    g.labores += 1;
    g.filas.push(f);
    if (f.subtotal == null) g.sin_tarifa += 1;
    g.total = totalLiquidacion(g.filas);
    grupos.set(f.trabajador_id, g);
  }
  return [...grupos.values()].sort((a, b) => a.trabajador_nombre.localeCompare(b.trabajador_nombre, "es"));
}

export function totalLiquidacion(filas: Pick<FilaLiquidacion, "subtotal">[]): number {
  return filas.reduce((s, f) => s + centavos(f.subtotal ?? 0), 0) / 100;
}

/** Combinaciones de labor y unidad que impiden cerrar, con la fecha más antigua que necesita tarifa. */
export function tarifasFaltantes(filas: FilaLiquidacion[]) {
  const faltan = new Map<string, { labor_nombre: string; unidad_medida: string; desde: string; labores: number }>();
  for (const f of filas) {
    if (f.valor_unitario != null) continue;
    const clave = `${f.labor_nombre}|${f.unidad_medida}`;
    const previa = faltan.get(clave);
    faltan.set(clave, {
      labor_nombre: f.labor_nombre,
      unidad_medida: f.unidad_medida,
      desde: previa && previa.desde < f.fecha ? previa.desde : f.fecha,
      labores: (previa?.labores ?? 0) + 1,
    });
  }
  return [...faltan.values()].sort((a, b) => a.labor_nombre.localeCompare(b.labor_nombre, "es"));
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });

export function formatoCop(n: number): string {
  return COP.format(n);
}
