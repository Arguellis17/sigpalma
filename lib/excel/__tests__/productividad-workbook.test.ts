import { describe, expect, it } from "vitest";
import type { ReporteProductividadPayload } from "@/app/actions/reportes-productividad";
import {
  HOJA_LOTES,
  HOJA_MENSUAL,
  HOJA_REGISTROS,
  HOJA_RESUMEN,
  buildProductividadWorkbook,
  conRendimientoExacto,
  etiquetaMes,
  formatoRendimiento,
} from "@/lib/excel/productividad-workbook";
import {
  agregarCosechasPorLote,
  agregarCosechasPorMes,
  agregarResumenFinca,
} from "@/lib/productividad";
import { cellText, expectSinCodigosInternos, openXlsx, sheetTexts } from "./helpers";

const lotes = [
  { id: "a", codigo: "L01", area_ha: 500 },
  { id: "b", codigo: "L-04", area_ha: 500 },
];
const registros = [
  { lote_id: "a", fecha: "2026-04-21", peso_kg: 15, conteo_racimos: 15 },
  { lote_id: "b", fecha: "2026-06-06", peso_kg: 50, conteo_racimos: 23 },
  { lote_id: "b", fecha: "2026-06-20", peso_kg: 10, conteo_racimos: 20 },
  { lote_id: "b", fecha: "2026-09-18", peso_kg: 40, conteo_racimos: 20 },
];

function payload(regs = registros): ReporteProductividadPayload {
  const filas = agregarCosechasPorLote(regs, lotes);
  const codigo = new Map(lotes.map((l) => [l.id, l.codigo]));
  return {
    finca_id: "f",
    finca_nombre: "UFPS",
    fecha_desde: "2026-01-01",
    fecha_hasta: "2026-10-06",
    filas,
    resumen: agregarResumenFinca(filas),
    mensual: agregarCosechasPorMes(regs, filas),
    registros: regs.map((r) => ({
      fecha: r.fecha,
      lote_codigo: codigo.get(r.lote_id)!,
      peso_kg: r.peso_kg,
      conteo_racimos: r.conteo_racimos,
    })),
  };
}

const GENERADO = new Date("2026-10-06T19:30:00Z");

describe("buildProductividadWorkbook", () => {
  it("crea las 4 hojas en orden, con Resumen como primera pestaña", async () => {
    const { wb } = await openXlsx(await buildProductividadWorkbook(payload(), GENERADO));
    expect(wb.worksheets.map((w) => w.name)).toEqual([HOJA_RESUMEN, HOJA_LOTES, HOJA_MENSUAL, HOJA_REGISTROS]);
  });

  it("Resumen: título, sello en hora Colombia e indicadores del periodo", async () => {
    const { wb } = await openXlsx(await buildProductividadWorkbook(payload(), GENERADO));
    const ws = wb.getWorksheet(HOJA_RESUMEN)!;
    expect(cellText(ws, "A1")).toBe("Reporte de productividad RFF (t/ha)");
    expect(cellText(ws, "A2")).toBe("UFPS · Periodo 01/01/2026 a 06/10/2026");
    expect(cellText(ws, "A3")).toContain("06/10/2026, 14:30"); // UTC-5
    expect(cellText(ws, "A6")).toBe("Rendimiento ponderado finca");
    // 0.115 t / 1000 ha: el payload lo redondea a 0; el Excel conserva el valor exacto.
    expect(ws.getCell("B6").value).toBeCloseTo(0.000115, 9);
    expect(ws.getCell("B6").numFmt).toBe("#,##0.000000");
    expect(ws.getCell("B7").value).toBe(0.115);
    expect(ws.getCell("B8").value).toBe(1000);
    expect(ws.getCell("B11").value).toBeCloseTo(115 / 78, 6); // kg por racimo
    expect(cellText(ws, "E6")).toContain("L-04");
  });

  it("Por lote: filas ordenadas, fórmulas vivas con resultado en caché y fila de totales", async () => {
    const { wb } = await openXlsx(await buildProductividadWorkbook(payload(), GENERADO));
    const ws = wb.getWorksheet(HOJA_LOTES)!;
    expect(ws.getRow(4).values).toEqual([
      undefined,
      "Lote",
      "Área (ha)",
      "Cosecha (kg)",
      "Cosecha (t)",
      "Racimos",
      "Registros",
      "Peso prom. racimo (kg)",
      "Rendimiento (t/ha)",
      "Promedio finca (t/ha)",
      "Variación vs. promedio",
    ]);
    expect(cellText(ws, "A5")).toBe("L-04");
    expect(cellText(ws, "A6")).toBe("L01");
    expect(ws.getCell("H5").value).toEqual({ formula: "IF(B5=0,0,D5/B5)", result: 0.0002 });
    expect(ws.getCell("I5").value).toMatchObject({ formula: "$H$7" });
    expect((ws.getCell("I5").value as { result: number }).result).toBeCloseTo(0.000115, 9);
    expect(cellText(ws, "A7")).toBe("TOTAL FINCA");
    expect(ws.getCell("D7").value).toEqual({ formula: "SUM(D5:D6)", result: 0.115 });
    expect(ws.getCell("E7").value).toEqual({ formula: "SUM(E5:E6)", result: 78 });
    expect(ws.getCell("J5").numFmt).toBe("+0.0%;-0.0%;0.0%");
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });
  });

  it("Mensual: un renglón por mes con etiqueta legible y participación", async () => {
    const { wb } = await openXlsx(await buildProductividadWorkbook(payload(), GENERADO));
    const ws = wb.getWorksheet(HOJA_MENSUAL)!;
    expect([5, 6, 7].map((r) => cellText(ws, `A${r}`))).toEqual(["abr 2026", "jun 2026", "sep 2026"]);
    expect(ws.getCell("B6").value).toBe(0.06);
    expect(cellText(ws, "A8")).toBe("TOTAL");
    expect((ws.getCell("F8").value as { result: number }).result).toBe(1);
  });

  it("Registros: fechas como fechas de Excel y totales", async () => {
    const { wb } = await openXlsx(await buildProductividadWorkbook(payload(), GENERADO));
    const ws = wb.getWorksheet(HOJA_REGISTROS)!;
    expect(ws.getCell("A5").value).toEqual(new Date(Date.UTC(2026, 3, 21)));
    expect(ws.getCell("A5").numFmt).toBe("dd/mm/yyyy");
    expect(ws.getCell("C9").value).toEqual({ formula: "SUM(C5:C8)", result: 115 });
  });

  it("incluye 2 gráficos nativos en Resumen que apuntan a las tablas", async () => {
    const { charts, read } = await openXlsx(await buildProductividadWorkbook(payload(), GENERADO));
    expect(charts).toHaveLength(2);
    const porLote = await read(charts[0]);
    expect(porLote).toContain("Rendimiento por lote (t/ha)");
    expect(porLote).toContain("&apos;Por lote&apos;!$H$5:$H$6");
    expect(porLote).toContain("&apos;Por lote&apos;!$A$5:$A$6");
    expect(porLote).toContain("<c:lineChart>"); // promedio finca
    const mensual = await read(charts[1]);
    expect(mensual).toContain("Producción mensual RFF");
    expect(mensual).toContain("&apos;Mensual&apos;!$B$5:$B$7");
    expect(mensual).toContain('<c:axPos val="r"/>'); // t/ha en eje secundario
    expect(await read("xl/worksheets/_rels/sheet1.xml.rels")).toContain("drawing1.xml");
  });

  it("no muestra códigos internos (HU/RN/CU/RF) en ninguna hoja ni gráfico", async () => {
    await expectSinCodigosInternos(await buildProductividadWorkbook(payload(), GENERADO));
    await expectSinCodigosInternos(await buildProductividadWorkbook(payload([]), GENERADO));
  });

  it("periodo sin cosechas: libro válido, sin gráficos y con aviso", async () => {
    const { wb, charts } = await openXlsx(await buildProductividadWorkbook(payload([]), GENERADO));
    expect(charts).toHaveLength(0);
    expect(sheetTexts(wb.getWorksheet(HOJA_LOTES)!)).toContain(
      "No hay cosechas registradas en el periodo seleccionado."
    );
    expect(wb.getWorksheet(HOJA_RESUMEN)!.getCell("B6").value).toBe(0);
  });
});

describe("precisión del rendimiento", () => {
  it("rendimientos reales de palma (≥0.1 t/ha) usan 3 decimales", async () => {
    const regs = [{ lote_id: "a", fecha: "2026-04-21", peso_kg: 9_000_000, conteo_racimos: 450_000 }];
    const p = payload(regs);
    expect(formatoRendimiento(conRendimientoExacto(p))).toBe("#,##0.000");
    const { wb, read, charts } = await openXlsx(await buildProductividadWorkbook(p, GENERADO));
    expect(wb.getWorksheet(HOJA_RESUMEN)!.getCell("B6").value).toBe(18); // 9000 t / 500 ha
    expect(await read(charts[0])).toContain('formatCode="0.000"');
  });

  it("valores pequeños no se pierden: t/ha exacto y 6 decimales", () => {
    const exacto = conRendimientoExacto(payload());
    expect(payload().filas.map((f) => f.ton_ha)).toEqual([0, 0]); // redondeo del payload
    expect(exacto.filas[0].ton_ha).toBeCloseTo(0.0002, 12);
    expect(exacto.filas[1].ton_ha).toBeCloseTo(0.00003, 12);
    expect(formatoRendimiento(exacto)).toBe("#,##0.000000");
  });
});

describe("etiquetaMes", () => {
  it("formatea yyyy-MM en español abreviado", () => {
    expect(etiquetaMes("2026-01")).toBe("ene 2026");
    expect(etiquetaMes("2025-12")).toBe("dic 2025");
  });
});
