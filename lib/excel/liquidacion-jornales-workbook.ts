import ExcelJS from "exceljs";
import { consolidarPorTrabajador, type FilaLiquidacion } from "@/lib/jornales";
import { labelUnidadMedidaLabor } from "@/lib/labor-ejecucion";
import {
  addAviso,
  addTitulo,
  configurarImpresion,
  formatGeneradoCo,
  styleDataRows,
  styleHeaderRow,
  styleTotalRow,
  ymdToExcelDate,
} from "@/lib/excel/estilos";

/** Liquidación de jornales en Excel: resumen por trabajador y detalle por labor. Solo servidor. */

export const HOJA_RESUMEN_JORNALES = "Resumen";
export const HOJA_DETALLE_JORNALES = "Detalle";

const FMT_COP = '"$"#,##0.00';
const FMT_CANTIDAD = "#,##0.##";
const HEADER_ROW = 4;
const FIRST_DATA_ROW = HEADER_ROW + 1;

export type DatosLiquidacionExcel = {
  consecutivo: number;
  finca_nombre: string;
  periodo_desde: string;
  periodo_hasta: string;
  is_voided: boolean;
  motivo_anulacion: string | null;
  filas: FilaLiquidacion[];
};

const fmtFecha = (ymd: string) => ymd.split("-").reverse().join("/");

export async function buildLiquidacionJornalesWorkbook(data: DatosLiquidacionExcel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIG-Palma";
  const generado = formatGeneradoCo(new Date());
  const subtitulo = `${data.finca_nombre} · ${fmtFecha(data.periodo_desde)} a ${fmtFecha(data.periodo_hasta)}`;

  // El resumen va primero y suma desde la hoja de detalle con fórmulas.
  const res = wb.addWorksheet(HOJA_RESUMEN_JORNALES, { views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }] });
  const det = wb.addWorksheet(HOJA_DETALLE_JORNALES, { views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }] });
  det.columns = [28, 16, 13, 26, 12, 12, 12, 15, 16].map((width) => ({ width }));
  addTitulo(det, { titulo: `Liquidación N.º ${data.consecutivo}: detalle por labor`, subtitulo, generado, lastCol: 9 });
  det.getRow(HEADER_ROW).values = ["Trabajador", "Documento", "Fecha", "Labor", "Lote", "Cantidad", "Unidad", "Valor unitario", "Subtotal"];
  styleHeaderRow(det, HEADER_ROW, 1, 9);

  const trabajadores = consolidarPorTrabajador(data.filas);
  const filas = trabajadores.flatMap((t) => t.filas);
  filas.forEach((f, i) => {
    const r = FIRST_DATA_ROW + i;
    det.getRow(r).values = [
      f.trabajador_nombre,
      f.trabajador_documento ?? "",
      ymdToExcelDate(f.fecha),
      f.labor_nombre,
      f.lote_codigo,
      f.cantidad,
      labelUnidadMedidaLabor(f.unidad_medida),
      f.valor_unitario,
      { formula: `ROUND(F${r}*H${r},2)`, result: f.subtotal ?? 0 },
    ];
    det.getCell(r, 3).numFmt = "dd/mm/yyyy";
    det.getCell(r, 6).numFmt = FMT_CANTIDAD;
    det.getCell(r, 8).numFmt = FMT_COP;
    det.getCell(r, 9).numFmt = FMT_COP;
  });
  const ultimaDet = FIRST_DATA_ROW + filas.length - 1;
  if (filas.length > 0) styleDataRows(det, FIRST_DATA_ROW, ultimaDet, 1, 9);
  configurarImpresion(det, "landscape", HEADER_ROW);

  res.columns = [32, 18, 12, 18].map((width) => ({ width }));
  addTitulo(res, { titulo: `Liquidación de jornales N.º ${data.consecutivo}`, subtitulo, generado, lastCol: 4 });
  res.getRow(HEADER_ROW).values = ["Trabajador", "Documento", "Labores", "Total a pagar"];
  styleHeaderRow(res, HEADER_ROW, 1, 4);

  // Cada trabajador suma sus propias filas de detalle (no por nombre: puede haber homónimos).
  let filaDetalle = FIRST_DATA_ROW;
  trabajadores.forEach((t, i) => {
    const r = FIRST_DATA_ROW + i;
    const hasta = filaDetalle + t.labores - 1;
    const rango = `${HOJA_DETALLE_JORNALES}!$I$${filaDetalle}:$I$${hasta}`;
    res.getRow(r).values = [
      t.trabajador_nombre,
      t.trabajador_documento ?? "",
      { formula: `ROWS(${rango})`, result: t.labores },
      { formula: `SUM(${rango})`, result: t.total },
    ];
    res.getCell(r, 4).numFmt = FMT_COP;
    filaDetalle = hasta + 1;
  });
  const ultimaRes = FIRST_DATA_ROW + trabajadores.length - 1;
  const filaTotal = ultimaRes + 1;
  if (trabajadores.length > 0) styleDataRows(res, FIRST_DATA_ROW, ultimaRes, 1, 4);
  const total = trabajadores.reduce((s, t) => s + Math.round(t.total * 100), 0) / 100;
  res.getRow(filaTotal).values = [
    "TOTAL",
    "",
    { formula: `SUM(C${FIRST_DATA_ROW}:C${ultimaRes})`, result: filas.length },
    { formula: `SUM(D${FIRST_DATA_ROW}:D${ultimaRes})`, result: total },
  ];
  res.getCell(filaTotal, 4).numFmt = FMT_COP;
  styleTotalRow(res, filaTotal, 1, 4);

  if (data.is_voided) {
    addAviso(res, filaTotal + 2, `LIQUIDACIÓN ANULADA. Motivo: ${data.motivo_anulacion ?? "sin motivo"}`, 4, "alerta");
  }
  configurarImpresion(res, "portrait", HEADER_ROW);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
