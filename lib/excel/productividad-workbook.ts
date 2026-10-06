import ExcelJS from "exceljs";
import type { ReporteProductividadPayload } from "@/app/actions/reportes-productividad";
import {
  COLOR,
  FMT,
  addAviso,
  addSeccion,
  addTitulo,
  configurarImpresion,
  formatGeneradoCo,
  solidFill,
  styleDataRows,
  styleHeaderRow,
  styleTotalRow,
  ymdToExcelDate,
} from "@/lib/excel/estilos";
import { addChartsToXlsx, sheetRef, type ChartSpec } from "@/lib/excel/xlsx-charts";

/** HU01 — Reporte de productividad (t/ha) en Excel con gráficos nativos. Solo servidor. */

export const HOJA_RESUMEN = "Resumen";
export const HOJA_LOTES = "Por lote";
export const HOJA_MENSUAL = "Mensual";
export const HOJA_REGISTROS = "Registros";

const HEADER_ROW = 4;
const FIRST_DATA_ROW = HEADER_ROW + 1;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-04" → "abr 2026" */
export function etiquetaMes(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MESES[m - 1] ?? "?"} ${y}`;
}

function fmtPeriodo(desde: string, hasta: string): string {
  const f = (ymd: string) => ymd.split("-").reverse().join("/");
  return `${f(desde)} a ${f(hasta)}`;
}

function hojaPorLote(wb: ExcelJS.Workbook, data: ReporteProductividadPayload, generado: string, fmtRend: string) {
  const ws = wb.addWorksheet(HOJA_LOTES, {
    views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }],
  });
  ws.columns = [14, 12, 14, 12, 11, 11, 14, 14, 14, 14].map((width) => ({ width }));
  const lastCol = 10;
  addTitulo(ws, {
    titulo: "Productividad por lote",
    subtitulo: `${data.finca_nombre} · ${fmtPeriodo(data.fecha_desde, data.fecha_hasta)}`,
    generado,
    lastCol,
  });

  ws.getRow(HEADER_ROW).values = [
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
  ];
  styleHeaderRow(ws, HEADER_ROW, 1, lastCol);

  const n = data.filas.length;
  if (n === 0) {
    addAviso(ws, FIRST_DATA_ROW, "No hay cosechas registradas en el periodo seleccionado.", lastCol, "info");
    configurarImpresion(ws, "landscape", HEADER_ROW);
    return { totalRow: null };
  }

  const lastData = FIRST_DATA_ROW + n - 1;
  const totalRow = lastData + 1;
  const pond = data.resumen.ton_ha_ponderado;

  data.filas.forEach((f, i) => {
    const r = FIRST_DATA_ROW + i;
    const pesoProm = f.total_racimos > 0 ? f.total_kg / f.total_racimos : 0;
    ws.getRow(r).values = [
      f.lote_codigo,
      f.area_ha,
      f.total_kg,
      { formula: `C${r}/1000`, result: f.total_ton },
      f.total_racimos,
      f.registros,
      { formula: `IF(E${r}=0,0,C${r}/E${r})`, result: pesoProm },
      { formula: `IF(B${r}=0,0,D${r}/B${r})`, result: f.ton_ha },
      { formula: `$H$${totalRow}`, result: pond },
      { formula: `IF($H$${totalRow}=0,0,H${r}/$H$${totalRow}-1)`, result: pond > 0 ? f.ton_ha / pond - 1 : 0 },
    ];
  });
  styleDataRows(ws, FIRST_DATA_ROW, lastData, 1, lastCol);

  const { resumen } = data;
  const totalKg = data.filas.reduce((s, f) => s + f.total_kg, 0);
  ws.getRow(totalRow).values = [
    "TOTAL FINCA",
    { formula: `SUM(B${FIRST_DATA_ROW}:B${lastData})`, result: resumen.area_ha_analizada },
    { formula: `SUM(C${FIRST_DATA_ROW}:C${lastData})`, result: totalKg },
    { formula: `SUM(D${FIRST_DATA_ROW}:D${lastData})`, result: resumen.total_ton },
    { formula: `SUM(E${FIRST_DATA_ROW}:E${lastData})`, result: resumen.total_racimos },
    { formula: `SUM(F${FIRST_DATA_ROW}:F${lastData})`, result: resumen.total_registros },
    {
      formula: `IF(E${totalRow}=0,0,C${totalRow}/E${totalRow})`,
      result: resumen.total_racimos > 0 ? totalKg / resumen.total_racimos : 0,
    },
    { formula: `IF(B${totalRow}=0,0,D${totalRow}/B${totalRow})`, result: pond },
    { formula: `H${totalRow}`, result: pond },
    "",
  ];
  styleTotalRow(ws, totalRow, 1, lastCol);

  const formats = [null, FMT.ha, FMT.kg, FMT.ton, FMT.entero, FMT.entero, FMT.kg, fmtRend, fmtRend, FMT.pct];
  for (let r = FIRST_DATA_ROW; r <= totalRow; r++) {
    formats.forEach((fmt, i) => {
      if (fmt) ws.getCell(r, i + 1).numFmt = fmt;
    });
    ws.getCell(r, 8).font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${COLOR.verdeOscuro}` } };
  }

  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastData, column: lastCol } };
  addAviso(
    ws,
    totalRow + 2,
    "Rendimiento (t/ha) = toneladas cosechadas del lote ÷ área del lote. Promedio finca ponderado = Σ t ÷ Σ ha de los lotes con cosecha. Se excluyen registros anulados.",
    lastCol,
    "info"
  );
  configurarImpresion(ws, "landscape", HEADER_ROW);
  return { totalRow };
}

function hojaMensual(wb: ExcelJS.Workbook, data: ReporteProductividadPayload, generado: string, fmtRend: string) {
  const ws = wb.addWorksheet(HOJA_MENSUAL, {
    views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }],
  });
  ws.columns = [14, 15, 12, 12, 16, 15].map((width) => ({ width }));
  const lastCol = 6;
  addTitulo(ws, {
    titulo: "Producción mensual",
    subtitulo: `${data.finca_nombre} · ${fmtPeriodo(data.fecha_desde, data.fecha_hasta)}`,
    generado,
    lastCol,
  });
  ws.getRow(HEADER_ROW).values = [
    "Mes",
    "Producción (t)",
    "Racimos",
    "Registros",
    "Rendimiento (t/ha)",
    "Participación",
  ];
  styleHeaderRow(ws, HEADER_ROW, 1, lastCol);

  const n = data.mensual.length;
  if (n === 0) {
    addAviso(ws, FIRST_DATA_ROW, "Sin producción en el periodo seleccionado.", lastCol, "info");
    configurarImpresion(ws, "portrait", HEADER_ROW);
    return;
  }
  const lastData = FIRST_DATA_ROW + n - 1;
  const totalRow = lastData + 1;
  const totalTon = data.mensual.reduce((s, m) => s + m.total_ton, 0);

  data.mensual.forEach((m, i) => {
    const r = FIRST_DATA_ROW + i;
    ws.getRow(r).values = [
      etiquetaMes(m.mes),
      m.total_ton,
      m.total_racimos,
      m.registros,
      m.ton_ha,
      { formula: `IF($B$${totalRow}=0,0,B${r}/$B$${totalRow})`, result: totalTon > 0 ? m.total_ton / totalTon : 0 },
    ];
  });
  styleDataRows(ws, FIRST_DATA_ROW, lastData, 1, lastCol);

  const sum = (col: string, result: number) => ({
    formula: `SUM(${col}${FIRST_DATA_ROW}:${col}${lastData})`,
    result,
  });
  ws.getRow(totalRow).values = [
    "TOTAL",
    sum("B", totalTon),
    sum("C", data.mensual.reduce((s, m) => s + m.total_racimos, 0)),
    sum("D", data.mensual.reduce((s, m) => s + m.registros, 0)),
    sum("E", data.mensual.reduce((s, m) => s + m.ton_ha, 0)),
    sum("F", 1),
  ];
  styleTotalRow(ws, totalRow, 1, lastCol);

  for (let r = FIRST_DATA_ROW; r <= totalRow; r++) {
    ws.getCell(r, 2).numFmt = FMT.ton;
    ws.getCell(r, 3).numFmt = FMT.entero;
    ws.getCell(r, 4).numFmt = FMT.entero;
    ws.getCell(r, 5).numFmt = fmtRend;
    ws.getCell(r, 6).numFmt = "0.0%";
  }
  addAviso(
    ws,
    totalRow + 2,
    `t/ha mensual = toneladas del mes ÷ área analizada del periodo (${data.resumen.area_ha_analizada.toLocaleString("es-CO")} ha). La suma de los meses equivale al rendimiento ponderado del periodo.`,
    lastCol,
    "info"
  );
  configurarImpresion(ws, "portrait", HEADER_ROW);
}

function hojaRegistros(wb: ExcelJS.Workbook, data: ReporteProductividadPayload, generado: string) {
  const ws = wb.addWorksheet(HOJA_REGISTROS, {
    views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }],
  });
  ws.columns = [13, 12, 13, 12, 11, 15].map((width) => ({ width }));
  const lastCol = 6;
  addTitulo(ws, {
    titulo: "Registros de cosecha RFF",
    subtitulo: `${data.finca_nombre} · ${fmtPeriodo(data.fecha_desde, data.fecha_hasta)}`,
    generado,
    lastCol,
  });
  ws.getRow(HEADER_ROW).values = [
    "Fecha",
    "Lote",
    "Peso (kg)",
    "Peso (t)",
    "Racimos",
    "Peso prom. racimo (kg)",
  ];
  styleHeaderRow(ws, HEADER_ROW, 1, lastCol);

  const n = data.registros.length;
  if (n === 0) {
    addAviso(ws, FIRST_DATA_ROW, "Sin registros de cosecha en el periodo.", lastCol, "info");
    configurarImpresion(ws, "portrait", HEADER_ROW);
    return;
  }
  const lastData = FIRST_DATA_ROW + n - 1;
  data.registros.forEach((c, i) => {
    const r = FIRST_DATA_ROW + i;
    ws.getRow(r).values = [
      ymdToExcelDate(c.fecha),
      c.lote_codigo,
      c.peso_kg,
      { formula: `C${r}/1000`, result: c.peso_kg / 1000 },
      c.conteo_racimos,
      {
        formula: `IF(E${r}=0,0,C${r}/E${r})`,
        result: c.conteo_racimos > 0 ? c.peso_kg / c.conteo_racimos : 0,
      },
    ];
  });
  styleDataRows(ws, FIRST_DATA_ROW, lastData, 1, lastCol);

  const totalRow = lastData + 1;
  const kg = data.registros.reduce((s, c) => s + c.peso_kg, 0);
  const rac = data.registros.reduce((s, c) => s + c.conteo_racimos, 0);
  ws.getRow(totalRow).values = [
    "TOTAL",
    `${n} registros`,
    { formula: `SUM(C${FIRST_DATA_ROW}:C${lastData})`, result: kg },
    { formula: `SUM(D${FIRST_DATA_ROW}:D${lastData})`, result: kg / 1000 },
    { formula: `SUM(E${FIRST_DATA_ROW}:E${lastData})`, result: rac },
    { formula: `IF(E${totalRow}=0,0,C${totalRow}/E${totalRow})`, result: rac > 0 ? kg / rac : 0 },
  ];
  styleTotalRow(ws, totalRow, 1, lastCol);

  for (let r = FIRST_DATA_ROW; r <= totalRow; r++) {
    ws.getCell(r, 1).numFmt = FMT.fecha;
    ws.getCell(r, 3).numFmt = FMT.kg;
    ws.getCell(r, 4).numFmt = FMT.ton;
    ws.getCell(r, 5).numFmt = FMT.entero;
    ws.getCell(r, 6).numFmt = FMT.kg;
  }
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastData, column: lastCol } };
  configurarImpresion(ws, "portrait", HEADER_ROW);
}

/** Fila (1-based) donde empiezan los gráficos en la hoja Resumen. */
export const RESUMEN_CHARTS_ROW = 15;

function hojaResumen(ws: ExcelJS.Worksheet, data: ReporteProductividadPayload, generado: string, fmtRend: string) {
  ws.columns = [34, 16, 14, 12, 12, 12, 12, 12, 12, 12, 12].map((width) => ({ width }));
  ws.views = [{ showGridLines: false }];
  const lastCol = 11;
  addTitulo(ws, {
    titulo: "Reporte de productividad RFF (t/ha)",
    subtitulo: `${data.finca_nombre} · Periodo ${fmtPeriodo(data.fecha_desde, data.fecha_hasta)}`,
    generado,
    lastCol,
  });

  addSeccion(ws, 5, "Indicadores del periodo", lastCol);
  const { resumen } = data;
  const totalKg = data.filas.reduce((s, f) => s + f.total_kg, 0);
  const kpis: [string, number, string, string][] = [
    ["Rendimiento ponderado finca", resumen.ton_ha_ponderado, "t/ha", fmtRend],
    ["Producción total RFF", resumen.total_ton, "t", FMT.ton],
    ["Área analizada (lotes con cosecha)", resumen.area_ha_analizada, "ha", FMT.ha],
    ["Lotes con cosecha", data.filas.length, "lotes", FMT.entero],
    ["Racimos cosechados", resumen.total_racimos, "racimos", FMT.entero],
    [
      "Peso promedio por racimo",
      resumen.total_racimos > 0 ? totalKg / resumen.total_racimos : 0,
      "kg",
      FMT.kg,
    ],
    ["Registros de cosecha", resumen.total_registros, "registros", FMT.entero],
  ];
  kpis.forEach(([label, value, unit, fmt], i) => {
    const r = 6 + i;
    const destacado = i === 0;
    const a = ws.getCell(r, 1);
    a.value = label;
    a.font = { name: "Calibri", size: destacado ? 12 : 10, bold: true, color: { argb: `FF${COLOR.gris}` } };
    a.alignment = { vertical: "middle", indent: 1 };
    const b = ws.getCell(r, 2);
    b.value = value;
    b.numFmt = fmt;
    b.font = {
      name: "Calibri",
      size: destacado ? 16 : 12,
      bold: true,
      color: { argb: `FF${destacado ? COLOR.verde : COLOR.verdeOscuro}` },
    };
    b.alignment = { horizontal: "right", vertical: "middle" };
    const c = ws.getCell(r, 3);
    c.value = unit;
    c.font = { name: "Calibri", size: 10, color: { argb: `FF${COLOR.grisClaro}` } };
    c.alignment = { vertical: "middle", indent: 1 };
    for (let col = 1; col <= 3; col++) {
      const cell = ws.getCell(r, col);
      cell.fill = solidFill(destacado ? COLOR.verdeClaro : i % 2 ? COLOR.cebra : COLOR.blanco);
      cell.border = { bottom: { style: "thin", color: { argb: `FF${COLOR.borde}` } } };
    }
    ws.getRow(r).height = destacado ? 26 : 20;
  });

  const mejor = [...data.filas].sort((a, b) => b.ton_ha - a.ton_ha)[0];
  if (mejor) {
    const cell = ws.getCell(6, 5);
    ws.mergeCells(6, 5, 7, lastCol);
    cell.value = `Lote con mayor rendimiento: ${mejor.lote_codigo} (${mejor.ton_ha.toLocaleString("es-CO", { maximumFractionDigits: fmtRend.split(".")[1].length })} t/ha)`;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: `FF${COLOR.okTexto}` } };
    cell.fill = solidFill(COLOR.okFondo);
    cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  }

  addSeccion(ws, RESUMEN_CHARTS_ROW - 1, "Gráficos", lastCol);
  if (data.filas.length === 0) {
    addAviso(ws, RESUMEN_CHARTS_ROW, "No hay cosechas registradas en el periodo seleccionado; no se generan gráficos.", lastCol, "info");
  }

  const notaRow = RESUMEN_CHARTS_ROW + (data.filas.length ? 22 : 2);
  addAviso(
    ws,
    notaRow,
    `Detalle en las hojas "${HOJA_LOTES}", "${HOJA_MENSUAL}" y "${HOJA_REGISTROS}". Fuente: cosechas RFF no anuladas registradas en SIG-Palma.`,
    lastCol,
    "info"
  );
  configurarImpresion(ws, "landscape");
}

function graficos(data: ReporteProductividadPayload, fmtRend: string): ChartSpec[] {
  const n = data.filas.length;
  if (n === 0) return [];
  const last = FIRST_DATA_ROW + n - 1;
  const top = RESUMEN_CHARTS_ROW - 1; // 0-based
  const chartFmt = fmtRend.replace("#,##", "");
  const charts: ChartSpec[] = [
    {
      sheetName: HOJA_RESUMEN,
      title: "Rendimiento por lote (t/ha)",
      anchor: { fromCol: 0, fromRow: top, toCol: 4, toRow: top + 20 },
      categoriesRef: sheetRef(HOJA_LOTES, "A", FIRST_DATA_ROW, last),
      categories: data.filas.map((f) => f.lote_codigo),
      bars: [
        {
          name: "Rendimiento (t/ha)",
          nameRef: sheetRef(HOJA_LOTES, "H", HEADER_ROW),
          valuesRef: sheetRef(HOJA_LOTES, "H", FIRST_DATA_ROW, last),
          values: data.filas.map((f) => f.ton_ha),
          color: COLOR.verde,
          labelFormat: chartFmt,
        },
      ],
      lines: [
        {
          name: "Promedio finca (t/ha)",
          nameRef: sheetRef(HOJA_LOTES, "I", HEADER_ROW),
          valuesRef: sheetRef(HOJA_LOTES, "I", FIRST_DATA_ROW, last),
          values: data.filas.map(() => data.resumen.ton_ha_ponderado),
          color: COLOR.naranja,
        },
      ],
      valueAxisTitle: "t/ha",
      valueAxisFormat: chartFmt,
    },
  ];

  const m = data.mensual.length;
  if (m > 0) {
    const lastM = FIRST_DATA_ROW + m - 1;
    charts.push({
      sheetName: HOJA_RESUMEN,
      title: "Producción mensual RFF",
      anchor: { fromCol: 4, fromRow: top, toCol: 11, toRow: top + 20 },
      categoriesRef: sheetRef(HOJA_MENSUAL, "A", FIRST_DATA_ROW, lastM),
      categories: data.mensual.map((x) => etiquetaMes(x.mes)),
      bars: [
        {
          name: "Producción (t)",
          nameRef: sheetRef(HOJA_MENSUAL, "B", HEADER_ROW),
          valuesRef: sheetRef(HOJA_MENSUAL, "B", FIRST_DATA_ROW, lastM),
          values: data.mensual.map((x) => x.total_ton),
          color: COLOR.verde,
          labelFormat: "0.000",
        },
      ],
      lines: [
        {
          name: "Rendimiento (t/ha)",
          nameRef: sheetRef(HOJA_MENSUAL, "E", HEADER_ROW),
          valuesRef: sheetRef(HOJA_MENSUAL, "E", FIRST_DATA_ROW, lastM),
          values: data.mensual.map((x) => x.ton_ha),
          color: COLOR.naranja,
        },
      ],
      linesOnSecondaryAxis: true,
      valueAxisTitle: "Toneladas",
      valueAxisFormat: "0.000",
      secondaryAxisTitle: "t/ha",
      secondaryAxisFormat: chartFmt,
    });
  }
  return charts;
}

const tonHa = (ton: number, ha: number) => (ha > 0 ? ton / ha : 0);

/**
 * El payload redondea t/ha a 3 decimales (pantalla). En Excel usamos el valor exacto —igual al
 * que calculan las fórmulas— para que cosechas pequeñas sobre lotes grandes no aparezcan como 0.
 */
export function conRendimientoExacto(d: ReporteProductividadPayload): ReporteProductividadPayload {
  const area = d.resumen.area_ha_analizada;
  return {
    ...d,
    filas: d.filas.map((f) => ({ ...f, ton_ha: tonHa(f.total_ton, f.area_ha) })),
    mensual: d.mensual.map((m) => ({ ...m, ton_ha: tonHa(m.total_ton, area) })),
    resumen: { ...d.resumen, ton_ha_ponderado: tonHa(d.resumen.total_ton, area) },
  };
}

/** 3 decimales para rendimientos normales (t/ha ≥ 0.1); 6 si son tan pequeños que se verían en 0. */
export function formatoRendimiento(d: ReporteProductividadPayload): string {
  const max = Math.max(0, ...d.filas.map((f) => f.ton_ha));
  return max > 0 && max < 0.1 ? "#,##0.000000" : FMT.tonHa;
}

export async function buildProductividadWorkbook(
  payload: ReporteProductividadPayload,
  generadoEn: Date = new Date()
): Promise<Buffer> {
  const data = conRendimientoExacto(payload);
  const fmtRend = formatoRendimiento(data);
  const generado = formatGeneradoCo(generadoEn);
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIG-Palma";
  wb.created = generadoEn;
  wb.title = `Productividad ${data.finca_nombre} ${data.fecha_desde} a ${data.fecha_hasta}`;
  // Excel recalcula al abrir: las fórmulas mandan sobre los valores en caché.
  wb.calcProperties = { fullCalcOnLoad: true };

  // Resumen primero para que sea la pestaña activa al abrir.
  const resumen = wb.addWorksheet(HOJA_RESUMEN);
  hojaPorLote(wb, data, generado, fmtRend);
  hojaMensual(wb, data, generado, fmtRend);
  hojaRegistros(wb, data, generado);
  hojaResumen(resumen, data, generado, fmtRend);

  const raw = await wb.xlsx.writeBuffer();
  return addChartsToXlsx(Buffer.from(raw as ArrayBuffer), graficos(data, fmtRend));
}
