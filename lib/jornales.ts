/** Consolidación de la liquidación de jornales (CR-06). El cálculo por labor lo hace la base de datos. */

export type FilaLiquidacion = {
  labor_id: string;
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
