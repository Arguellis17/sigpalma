import ExcelJS from "exceljs";
import type { ExpedienteRspoPdfData } from "@/lib/pdf/expediente-rspo-types";
import {
  COLOR,
  FMT,
  addAviso,
  addSeccion,
  addTitulo,
  configurarImpresion,
  formatGeneradoCo,
  sinCodigosInternos,
  styleDataRows,
  styleHeaderRow,
  styleTotalRow,
  ymdToExcelDate,
} from "@/lib/excel/estilos";
import { addChartsToXlsx, sheetRef, type ChartSpec } from "@/lib/excel/xlsx-charts";
import { labelEstadoCultivo } from "@/lib/lote-estado";
import { CATEGORIA_EXPEDIENTE_LABEL } from "@/lib/trazabilidad/expediente-rspo";
import type { TimelineEvent, TimelineEventCategory } from "@/lib/trazabilidad/types";

/** HU02 — Informe de trazabilidad RSPO en Excel (auditoría). Solo servidor. */

export const HOJA_EXPEDIENTE = "Expediente";
export const HOJA_LINEA_VIDA = "Línea de vida";
export const HOJA_COSECHA_DESPACHO = "Cosecha y despacho";

const CATEGORIAS = Object.keys(CATEGORIA_EXPEDIENTE_LABEL) as TimelineEventCategory[];

const ymdRe = /^\d{4}-\d{2}-\d{2}$/;

/** "pesoTotalKg" → "Peso total kg" */
export function etiquetaCampo(key: string): string {
  const s = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Metadatos legibles para auditoría; los IDs van en su propia columna. */
export function resumirMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([k, v]) => k !== "tipo" && !/Id$/.test(k) && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const val =
        typeof v === "boolean" ? (v ? "Sí" : "No") : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${etiquetaCampo(k)}: ${val}`;
    })
    .join(" · ");
}

function idRegistro(ev: TimelineEvent): string {
  return ev.id.includes(":") ? ev.id.slice(ev.id.indexOf(":") + 1) : ev.id;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** t/ha exacto: 3 decimales para rendimientos normales, 6 si es tan pequeño que se vería en 0. */
function fmtTonHaTexto(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v > 0 && v < 0.1 ? v.toFixed(6) : v.toFixed(3);
}

function fechaCell(ymd: string): Date | string {
  return ymdRe.test(ymd) ? ymdToExcelDate(ymd) : ymd;
}

function ordenarDesc(eventos: TimelineEvent[]): TimelineEvent[] {
  return [...eventos].sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
}

/** Fila (1-based) del encabezado de la tabla de categorías en la hoja Expediente. */
type ExpedienteLayout = { catHeaderRow: number };

function hojaExpediente(ws: ExcelJS.Worksheet, data: ExpedienteRspoPdfData, generado: string): ExpedienteLayout {
  const tr = data.trazabilidad;
  ws.columns = [30, 44, 4, 12, 12, 12, 12, 12, 12].map((width) => ({ width }));
  ws.views = [{ showGridLines: false }];
  const lastCol = 9;
  addTitulo(ws, {
    titulo: "Expediente de trazabilidad RSPO",
    subtitulo: `${data.finca_nombre} · Lote ${data.lote_codigo}`,
    generado,
    lastCol,
  });

  let r = 5;
  const par = (label: string, value: ExcelJS.CellValue, fmt?: string) => {
    const a = ws.getCell(r, 1);
    a.value = label;
    a.font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${COLOR.gris}` } };
    a.alignment = { vertical: "top", indent: 1 };
    const b = ws.getCell(r, 2);
    b.value = value;
    b.font = { name: "Calibri", size: 10 };
    b.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    if (fmt) b.numFmt = fmt;
    for (const c of [a, b]) {
      c.border = { bottom: { style: "thin", color: { argb: `FF${COLOR.borde}` } } };
    }
    r += 1;
  };

  addSeccion(ws, r++, "Ficha del lote", 2);
  par("Finca", data.finca_nombre);
  par("Lote", data.lote_codigo);
  par("Área (ha)", data.area_ha, FMT.ha);
  par("Material genético", data.material_genetico ?? "—");
  par("Año de siembra", data.anio_siembra);
  par("Estado del cultivo", labelEstadoCultivo(data.estado_cultivo));
  par("Lote activo", tr.lote.activo ? "Sí" : "No");

  r += 1;
  addSeccion(ws, r++, "Procedencia de la fruta", 2);
  ws.mergeCells(r, 1, r, 2);
  const proc = ws.getCell(r, 1);
  proc.value =
    "La fruta procede de un lote registrado en la estructura legal de la finca (verificación de procedencia / no deforestación según los datos del sistema).";
  proc.font = { name: "Calibri", size: 10, color: { argb: `FF${COLOR.gris}` } };
  proc.alignment = { wrapText: true, vertical: "top", indent: 1 };
  ws.getRow(r).height = 30;
  r += 2;

  addSeccion(ws, r++, "Estado de completitud", 2);
  if (data.advertencias.length === 0) {
    addAviso(ws, r++, "✔ Cadena de datos completa para exportación.", 2, "ok");
  } else {
    for (const a of data.advertencias) {
      addAviso(ws, r++, `⚠ ${sinCodigosInternos(a.mensaje)}`, 2, "alerta");
    }
  }
  r += 1;

  addSeccion(ws, r++, "Indicadores de la ruta técnica", 2);
  const res = tr.resumen;
  par("Eventos en la línea de vida", tr.eventos.length, FMT.entero);
  par("Cosechas registradas en el lote", res.cosechasEnLote, FMT.entero);
  par(
    "Última cosecha",
    res.ultimaCosecha
      ? `${res.ultimaCosecha.fecha} · ${(res.ultimaCosecha.pesoKg / 1000).toFixed(3)} t · ${res.ultimaCosecha.conteoRacimos} racimos · ${fmtTonHaTexto(res.ultimaCosecha.pesoKg / 1000 / data.area_ha)} t/ha`
      : "Sin cosechas"
  );
  par("Rendimiento promedio finca (t/ha)", res.rendimientoPromedioFinca ?? "—", FMT.tonHa);
  par("Tendencia", sinCodigosInternos(res.tendenciaTexto ?? "Se requieren al menos dos cosechas."));
  par(
    "Alerta fitosanitaria relevante",
    res.ultimaAlertaFuerte
      ? `${res.ultimaAlertaFuerte.title} · severidad ${res.ultimaAlertaFuerte.severidad} · ${res.ultimaAlertaFuerte.sortAt.slice(0, 10)}`
      : "Sin alertas"
  );
  r += 1;

  addSeccion(ws, r++, "Eventos por categoría", 2);
  const catHeaderRow = r;
  ws.getRow(r).values = ["Categoría", "Eventos"];
  styleHeaderRow(ws, r, 1, 2);
  r += 1;
  const firstCat = r;
  for (const k of CATEGORIAS) {
    ws.getRow(r).values = [CATEGORIA_EXPEDIENTE_LABEL[k], res.conteoPorCategoria[k] ?? 0];
    ws.getCell(r, 2).numFmt = FMT.entero;
    ws.getCell(r, 2).alignment = { horizontal: "right" };
    r += 1;
  }
  styleDataRows(ws, firstCat, r - 1, 1, 2);
  ws.getRow(r).values = [
    "TOTAL",
    { formula: `SUM(B${firstCat}:B${r - 1})`, result: tr.eventos.length },
  ];
  ws.getCell(r, 2).numFmt = FMT.entero;
  styleTotalRow(ws, r, 1, 2);
  r += 2;

  ws.mergeCells(r, 1, r + 1, lastCol);
  const pie = ws.getCell(r, 1);
  pie.value =
    "Documento generado por SIG-Palma. No incluye registros anulados.";
  pie.font = { name: "Calibri", size: 8, italic: true, color: { argb: `FF${COLOR.grisClaro}` } };
  pie.alignment = { wrapText: true, vertical: "top", indent: 1 };

  configurarImpresion(ws, "portrait");
  return { catHeaderRow };
}

function hojaLineaVida(wb: ExcelJS.Workbook, data: ExpedienteRspoPdfData, generado: string) {
  const ws = wb.addWorksheet(HOJA_LINEA_VIDA, {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
  });
  ws.columns = [12, 15, 32, 40, 60, 38].map((width) => ({ width }));
  const lastCol = 6;
  addTitulo(ws, {
    titulo: "Línea de vida del lote (orden cronológico descendente)",
    subtitulo: `${data.finca_nombre} · Lote ${data.lote_codigo} · ${data.trazabilidad.eventos.length} eventos`,
    generado,
    lastCol,
  });
  ws.getRow(4).values = ["Fecha", "Categoría", "Evento", "Detalle", "Datos del registro", "ID registro"];
  styleHeaderRow(ws, 4, 1, lastCol);

  const eventos = ordenarDesc(data.trazabilidad.eventos);
  if (eventos.length === 0) {
    addAviso(ws, 5, "El lote no tiene eventos registrados.", lastCol, "info");
    configurarImpresion(ws, "landscape", 4);
    return;
  }
  eventos.forEach((ev, i) => {
    const r = 5 + i;
    ws.getRow(r).values = [
      fechaCell(ev.displayDate),
      CATEGORIA_EXPEDIENTE_LABEL[ev.category] ?? ev.category,
      sinCodigosInternos(ev.title),
      sinCodigosInternos(ev.subtitle ?? ""),
      sinCodigosInternos(resumirMetadata(ev.metadata)),
      idRegistro(ev),
    ];
    ws.getCell(r, 1).numFmt = FMT.fecha;
    for (const c of [3, 4, 5]) ws.getCell(r, c).alignment = { wrapText: true, vertical: "top" };
    ws.getCell(r, 6).font = { name: "Consolas", size: 8, color: { argb: `FF${COLOR.grisClaro}` } };
  });
  const last = 4 + eventos.length;
  styleDataRows(ws, 5, last, 1, lastCol);
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: lastCol } };
  configurarImpresion(ws, "landscape", 4);
}

function hojaCosechaDespacho(wb: ExcelJS.Workbook, data: ExpedienteRspoPdfData, generado: string) {
  const ws = wb.addWorksheet(HOJA_COSECHA_DESPACHO, { views: [{ showGridLines: false }] });
  ws.columns = [12, 22, 12, 14, 16, 22, 24, 26].map((width) => ({ width }));
  const lastCol = 8;
  addTitulo(ws, {
    titulo: "Cadena de custodia: cosecha → despacho",
    subtitulo: `${data.finca_nombre} · Lote ${data.lote_codigo}`,
    generado,
    lastCol,
  });

  const eventos = [...data.trazabilidad.eventos].sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  const cosechas = eventos.filter((e) => e.metadata.tipo === "cosecha_rff");
  const remisiones = eventos.filter((e) => e.metadata.tipo === "remision_despacho");

  let r = 5;
  addSeccion(ws, r++, `Cosechas RFF (${cosechas.length})`, lastCol);
  ws.getRow(r).values = ["Fecha", "Peso (kg)", "Peso (t)", "Racimos", "Rendimiento (t/ha)", "Observaciones de calidad"];
  ws.mergeCells(r, 6, r, lastCol);
  styleHeaderRow(ws, r, 1, lastCol);
  r += 1;
  if (cosechas.length === 0) {
    addAviso(ws, r++, "Sin cosechas registradas en el lote.", lastCol, "info");
  } else {
    const first = r;
    for (const c of cosechas) {
      const kg = num(c.metadata.pesoKg);
      ws.getRow(r).values = [
        fechaCell(c.displayDate),
        kg,
        { formula: `B${r}/1000`, result: kg / 1000 },
        num(c.metadata.conteoRacimos),
        // Exacto (el payload lo redondea a 3 decimales): t del registro ÷ área del lote.
        { formula: `IF(${data.area_ha}=0,0,C${r}/${data.area_ha})`, result: data.area_ha > 0 ? kg / 1000 / data.area_ha : 0 },
        str(c.metadata.observaciones),
      ];
      ws.mergeCells(r, 6, r, lastCol);
      ws.getCell(r, 6).alignment = { wrapText: true, vertical: "top" };
      r += 1;
    }
    styleDataRows(ws, first, r - 1, 1, lastCol);
    const kgTot = cosechas.reduce((s, c) => s + num(c.metadata.pesoKg), 0);
    ws.getRow(r).values = [
      "TOTAL",
      { formula: `SUM(B${first}:B${r - 1})`, result: kgTot },
      { formula: `SUM(C${first}:C${r - 1})`, result: kgTot / 1000 },
      { formula: `SUM(D${first}:D${r - 1})`, result: cosechas.reduce((s, c) => s + num(c.metadata.conteoRacimos), 0) },
      { formula: `IF(${data.area_ha}=0,0,C${r}/${data.area_ha})`, result: data.area_ha > 0 ? kgTot / 1000 / data.area_ha : 0 },
    ];
    styleTotalRow(ws, r, 1, lastCol);
    const maxTonHa = data.area_ha > 0 ? Math.max(...cosechas.map((c) => num(c.metadata.pesoKg))) / 1000 / data.area_ha : 0;
    const fmtTonHa = maxTonHa > 0 && maxTonHa < 0.1 ? "#,##0.000000" : FMT.tonHa;
    for (let i = first; i <= r; i++) {
      ws.getCell(i, 1).numFmt = FMT.fecha;
      ws.getCell(i, 2).numFmt = FMT.kg;
      ws.getCell(i, 3).numFmt = FMT.ton;
      ws.getCell(i, 4).numFmt = FMT.entero;
      ws.getCell(i, 5).numFmt = fmtTonHa;
    }
    r += 1;
  }

  r += 1;
  addSeccion(ws, r++, `Remisiones de despacho (${remisiones.length})`, lastCol);
  ws.getRow(r).values = [
    "Fecha",
    "N° remisión",
    "Placa",
    "Peso total (kg)",
    "Peso total (t)",
    "Conductor",
    "Identificación conductor",
    "Destino",
  ];
  styleHeaderRow(ws, r, 1, lastCol);
  r += 1;
  if (remisiones.length === 0) {
    addAviso(
      ws,
      r++,
      cosechas.length > 0
        ? "⚠ Hay cosecha registrada pero no consta remisión de despacho."
        : "Sin remisiones de despacho asociadas al lote.",
      lastCol,
      cosechas.length > 0 ? "alerta" : "info"
    );
  } else {
    const first = r;
    for (const e of remisiones) {
      const kg = num(e.metadata.pesoTotalKg);
      ws.getRow(r).values = [
        fechaCell(e.displayDate),
        str(e.metadata.numeroRemision),
        str(e.metadata.placa),
        kg,
        { formula: `D${r}/1000`, result: kg / 1000 },
        str(e.metadata.conductorNombre),
        str(e.metadata.conductorId),
        str(e.metadata.destino),
      ];
      ws.getCell(r, 1).numFmt = FMT.fecha;
      ws.getCell(r, 4).numFmt = FMT.kg;
      ws.getCell(r, 5).numFmt = FMT.ton;
      ws.getCell(r, 8).alignment = { wrapText: true, vertical: "top" };
      r += 1;
    }
    styleDataRows(ws, first, r - 1, 1, lastCol);
    addAviso(
      ws,
      r + 1,
      "El peso de cada remisión corresponde al despacho completo y puede incluir fruta de otros lotes de la finca.",
      lastCol,
      "info"
    );
  }
  configurarImpresion(ws, "landscape");
}

function graficoCategorias(data: ExpedienteRspoPdfData, layout: ExpedienteLayout): ChartSpec[] {
  const first = layout.catHeaderRow + 1;
  const last = first + CATEGORIAS.length - 1;
  return [
    {
      sheetName: HOJA_EXPEDIENTE,
      title: "Eventos de trazabilidad por categoría",
      anchor: { fromCol: 3, fromRow: 4, toCol: 9, toRow: 24 },
      barDir: "bar",
      categoriesRef: sheetRef(HOJA_EXPEDIENTE, "A", first, last),
      categories: CATEGORIAS.map((k) => CATEGORIA_EXPEDIENTE_LABEL[k]),
      bars: [
        {
          name: "Eventos",
          nameRef: sheetRef(HOJA_EXPEDIENTE, "B", layout.catHeaderRow),
          valuesRef: sheetRef(HOJA_EXPEDIENTE, "B", first, last),
          values: CATEGORIAS.map((k) => data.trazabilidad.resumen.conteoPorCategoria[k] ?? 0),
          color: COLOR.verde,
          labelFormat: "0",
        },
      ],
      valueAxisFormat: "0",
    },
  ];
}

export async function buildExpedienteRspoWorkbook(
  data: ExpedienteRspoPdfData,
  generadoEn: Date = new Date()
): Promise<Buffer> {
  const generado = formatGeneradoCo(generadoEn);
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIG-Palma";
  wb.created = generadoEn;
  wb.title = `Expediente RSPO ${data.finca_nombre} lote ${data.lote_codigo}`;
  wb.calcProperties = { fullCalcOnLoad: true };

  const expediente = wb.addWorksheet(HOJA_EXPEDIENTE);
  const layout = hojaExpediente(expediente, data, generado);
  hojaLineaVida(wb, data, generado);
  hojaCosechaDespacho(wb, data, generado);

  const raw = await wb.xlsx.writeBuffer();
  return addChartsToXlsx(Buffer.from(raw as ArrayBuffer), graficoCategorias(data, layout));
}
