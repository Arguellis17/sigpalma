/** HU08 RN21 / HU27: rendimiento RFF en toneladas por hectárea. */

export function rendimientoTonHa(pesoKg: number, areaHa: number): number {
  if (!Number.isFinite(areaHa) || areaHa <= 0 || !Number.isFinite(pesoKg)) {
    return 0;
  }
  const ton = pesoKg / 1000;
  return Math.round((ton / areaHa) * 1000) / 1000;
}

export type CosechaAgregadaRow = {
  lote_id: string;
  lote_codigo: string;
  area_ha: number;
  total_kg: number;
  total_ton: number;
  total_racimos: number;
  registros: number;
  ton_ha: number;
};

export type CosechaRegistroMin = {
  lote_id: string;
  peso_kg: number;
  conteo_racimos: number;
};

export type LoteAreaMin = {
  id: string;
  codigo: string;
  area_ha: number;
};

/** Agrega cosechas del periodo por lote (RN21: sum(ton) / ha del lote). */
export function agregarCosechasPorLote(
  registros: CosechaRegistroMin[],
  lotes: LoteAreaMin[]
): CosechaAgregadaRow[] {
  const loteMap = new Map(lotes.map((l) => [l.id, l]));
  const acc = new Map<
    string,
    { kg: number; racimos: number; count: number }
  >();

  for (const r of registros) {
    const cur = acc.get(r.lote_id) ?? { kg: 0, racimos: 0, count: 0 };
    cur.kg += r.peso_kg;
    cur.racimos += r.conteo_racimos;
    cur.count += 1;
    acc.set(r.lote_id, cur);
  }

  const rows: CosechaAgregadaRow[] = [];
  for (const [loteId, totals] of acc) {
    const lote = loteMap.get(loteId);
    if (!lote || !Number.isFinite(lote.area_ha) || lote.area_ha <= 0) {
      continue;
    }
    const totalTon = totals.kg / 1000;
    rows.push({
      lote_id: loteId,
      lote_codigo: lote.codigo,
      area_ha: lote.area_ha,
      total_kg: Math.round(totals.kg * 1000) / 1000,
      total_ton: Math.round(totalTon * 1000) / 1000,
      total_racimos: totals.racimos,
      registros: totals.count,
      ton_ha: rendimientoTonHa(totals.kg, lote.area_ha),
    });
  }

  return rows.sort((a, b) => a.lote_codigo.localeCompare(b.lote_codigo));
}

export type ResumenFincaProductividad = {
  total_ton: number;
  total_racimos: number;
  total_registros: number;
  area_ha_analizada: number;
  ton_ha_ponderado: number;
};

/** Promedio ponderado t/ha a nivel finca: sum(ton) / sum(ha) de lotes con datos. */
export function agregarResumenFinca(
  filas: CosechaAgregadaRow[]
): ResumenFincaProductividad {
  if (filas.length === 0) {
    return {
      total_ton: 0,
      total_racimos: 0,
      total_registros: 0,
      area_ha_analizada: 0,
      ton_ha_ponderado: 0,
    };
  }
  const totalTon = filas.reduce((s, f) => s + f.total_ton, 0);
  const totalRacimos = filas.reduce((s, f) => s + f.total_racimos, 0);
  const totalReg = filas.reduce((s, f) => s + f.registros, 0);
  const areaHa = filas.reduce((s, f) => s + f.area_ha, 0);
  const tonHaPond = areaHa > 0 ? Math.round((totalTon / areaHa) * 1000) / 1000 : 0;
  return {
    total_ton: Math.round(totalTon * 1000) / 1000,
    total_racimos: totalRacimos,
    total_registros: totalReg,
    area_ha_analizada: Math.round(areaHa * 10000) / 10000,
    ton_ha_ponderado: tonHaPond,
  };
}
