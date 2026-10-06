import { describe, expect, it } from "vitest";
import {
  agregarCosechasPorLote,
  agregarCosechasPorMes,
  agregarResumenFinca,
} from "@/lib/productividad";
import { parseReporteProductividadQuery } from "@/lib/validations/productividad";

const lotes = [
  { id: "a", codigo: "L01", area_ha: 4 },
  { id: "b", codigo: "L02", area_ha: 6 },
  { id: "z", codigo: "SIN-AREA", area_ha: 0 },
];
const registros = [
  { lote_id: "a", fecha: "2026-05-02", peso_kg: 8000, conteo_racimos: 400 },
  { lote_id: "b", fecha: "2026-04-15", peso_kg: 6000, conteo_racimos: 300 },
  { lote_id: "a", fecha: "2026-04-30", peso_kg: 2000, conteo_racimos: 100 },
  { lote_id: "z", fecha: "2026-04-10", peso_kg: 9999, conteo_racimos: 1 },
];

describe("agregarCosechasPorMes", () => {
  const filas = agregarCosechasPorLote(registros, lotes);

  it("agrupa por mes en orden cronológico y excluye lotes sin área válida", () => {
    expect(agregarCosechasPorMes(registros, filas)).toEqual([
      { mes: "2026-04", total_ton: 8, total_racimos: 400, registros: 2, ton_ha: 0.8 },
      { mes: "2026-05", total_ton: 8, total_racimos: 400, registros: 1, ton_ha: 0.8 },
    ]);
  });

  it("la suma mensual de t/ha coincide con el ponderado de la finca", () => {
    const meses = agregarCosechasPorMes(registros, filas);
    const resumen = agregarResumenFinca(filas);
    expect(meses.reduce((s, m) => s + m.ton_ha, 0)).toBeCloseTo(resumen.ton_ha_ponderado, 2);
    expect(meses.reduce((s, m) => s + m.total_ton, 0)).toBeCloseTo(resumen.total_ton, 6);
  });

  it("sin registros devuelve serie vacía", () => {
    expect(agregarCosechasPorMes([], [])).toEqual([]);
  });
});

describe("parseReporteProductividadQuery", () => {
  const finca = "d4e96ae4-05af-40da-8868-2fb8509dc4ae";
  const url = (qs: string) => new URL(`http://x/api?${qs}`);

  it("acepta filtros válidos y separa lote_ids", () => {
    const r = parseReporteProductividadQuery(
      url(`finca_id=${finca}&fecha_desde=2026-01-01&fecha_hasta=2026-02-01&lote_ids=${finca}, ${finca}`)
    );
    expect(r.success && r.data.lote_ids).toEqual([finca, finca]);
  });

  it("rechaza rango invertido y finca inválida", () => {
    expect(
      parseReporteProductividadQuery(url(`finca_id=${finca}&fecha_desde=2026-02-01&fecha_hasta=2026-01-01`)).success
    ).toBe(false);
    expect(parseReporteProductividadQuery(url("finca_id=x&fecha_desde=2026-01-01&fecha_hasta=2026-01-02")).success).toBe(
      false
    );
  });
});
