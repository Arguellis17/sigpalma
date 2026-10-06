import type ExcelJS from "exceljs";

/** Paleta de los exportables (hex sin '#'): verde palma oscuro para cabeceras, verde para datos. */
export const COLOR = {
  verdeOscuro: "1F5F3F",
  verde: "2E9E6B",
  verdeClaro: "E8F5EE",
  naranja: "E8833A",
  ambarFondo: "FFF4D6",
  ambarTexto: "8A5A00",
  okFondo: "E3F4E9",
  okTexto: "1E6B3E",
  gris: "595959",
  grisClaro: "8C8C8C",
  borde: "D9D9D9",
  cebra: "F6F8F7",
  blanco: "FFFFFF",
} as const;

export const FMT = {
  ha: "#,##0.00",
  kg: "#,##0.0",
  ton: "#,##0.000",
  tonHa: "#,##0.000",
  entero: "#,##0",
  pct: "+0.0%;-0.0%;0.0%",
  fecha: "dd/mm/yyyy",
} as const;

const argb = (hex: string) => `FF${hex}`;

export function solidFill(hex: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } };
}

const bordeFino: Partial<ExcelJS.Border> = { style: "thin", color: { argb: argb(COLOR.borde) } };

/**
 * Quita referencias internas de requisitos (HU29, RN25, CU09.1, RF08, RNF-03…) de textos que
 * provienen de la app, para que no aparezcan en los documentos que recibe el usuario.
 */
export function sinCodigosInternos(texto: string): string {
  const codigo = String.raw`(?:RNF|HU|RN|CU|RF)-?\d+(?:\.\d+)*`;
  return texto
    .replace(new RegExp(String.raw`\s*\(\s*${codigo}(?:\s*[·,/]\s*${codigo})*\s*\)`, "g"), "")
    .replace(new RegExp(String.raw`\s*\b${codigo}\b`, "g"), "")
    // Separadores huérfanos que quedan dentro de paréntesis: "( · RSPO)" → "(RSPO)".
    .replace(/\(\s*[·,/]\s*/g, "(")
    .replace(/\s*[·,/]\s*\)/g, ")")
    .replace(/\s*\(\s*\)/g, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** "06/10/2026, 14:05" en hora de Colombia, independiente de la zona del servidor. */
export function formatGeneradoCo(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** yyyy-MM-dd → Date UTC (Excel la muestra como fecha sin desfase de zona). */
export function ymdToExcelDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Filas 1-3: banda de título, subtítulo y sello de generación. */
export function addTitulo(
  ws: ExcelJS.Worksheet,
  opts: { titulo: string; subtitulo: string; generado: string; lastCol: number }
) {
  const { lastCol } = opts;
  ws.mergeCells(1, 1, 1, lastCol);
  ws.mergeCells(2, 1, 2, lastCol);
  ws.mergeCells(3, 1, 3, lastCol);

  const t = ws.getCell(1, 1);
  t.value = opts.titulo;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: argb(COLOR.blanco) } };
  t.fill = solidFill(COLOR.verdeOscuro);
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 30;

  const s = ws.getCell(2, 1);
  s.value = opts.subtitulo;
  s.font = { name: "Calibri", size: 11, bold: true, color: { argb: argb(COLOR.verdeOscuro) } };
  s.fill = solidFill(COLOR.verdeClaro);
  s.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 20;

  const g = ws.getCell(3, 1);
  g.value = `Generado: ${opts.generado} (hora Colombia) · SIG-Palma`;
  g.font = { name: "Calibri", size: 9, italic: true, color: { argb: argb(COLOR.grisClaro) } };
  g.alignment = { indent: 1 };
}

/** Rótulo de sección: texto verde en negrita con línea inferior. */
export function addSeccion(ws: ExcelJS.Worksheet, row: number, texto: string, lastCol: number) {
  ws.mergeCells(row, 1, row, lastCol);
  const c = ws.getCell(row, 1);
  c.value = texto.toUpperCase();
  c.font = { name: "Calibri", size: 10, bold: true, color: { argb: argb(COLOR.verdeOscuro) } };
  c.border = { bottom: { style: "medium", color: { argb: argb(COLOR.verde) } } };
  ws.getRow(row).height = 20;
}

export function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, fromCol: number, toCol: number) {
  ws.getRow(row).height = 32;
  for (let c = fromCol; c <= toCol; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: argb(COLOR.blanco) } };
    cell.fill = solidFill(COLOR.verde);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };
  }
}

/** Bordes finos + filas cebra en el bloque de datos. */
export function styleDataRows(
  ws: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
  fromCol: number,
  toCol: number
) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c);
      cell.border = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };
      cell.font = { name: "Calibri", size: 10, ...cell.font };
      if ((r - fromRow) % 2 === 1) cell.fill = solidFill(COLOR.cebra);
      cell.alignment = { vertical: "top", ...cell.alignment };
    }
  }
}

export function styleTotalRow(ws: ExcelJS.Worksheet, row: number, fromCol: number, toCol: number) {
  for (let c = fromCol; c <= toCol; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: argb(COLOR.verdeOscuro) } };
    cell.fill = solidFill(COLOR.verdeClaro);
    cell.border = {
      top: { style: "medium", color: { argb: argb(COLOR.verde) } },
      bottom: bordeFino,
      left: bordeFino,
      right: bordeFino,
    };
  }
}

/** Mensaje destacado a todo lo ancho (advertencia ámbar u OK verde). */
export function addAviso(
  ws: ExcelJS.Worksheet,
  row: number,
  texto: string,
  lastCol: number,
  tono: "ok" | "alerta" | "info"
) {
  ws.mergeCells(row, 1, row, lastCol);
  const c = ws.getCell(row, 1);
  c.value = texto;
  const [fondo, color] =
    tono === "ok"
      ? [COLOR.okFondo, COLOR.okTexto]
      : tono === "alerta"
        ? [COLOR.ambarFondo, COLOR.ambarTexto]
        : [COLOR.cebra, COLOR.gris];
  c.fill = solidFill(fondo);
  c.font = { name: "Calibri", size: 10, color: { argb: argb(color) }, bold: tono !== "info" };
  c.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  ws.getRow(row).height = Math.max(20, Math.ceil(texto.length / 110) * 15);
}

export function configurarImpresion(
  ws: ExcelJS.Worksheet,
  orientation: "portrait" | "landscape",
  printTitlesRow?: number
) {
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    ...(printTitlesRow ? { printTitlesRow: `${printTitlesRow}:${printTitlesRow}` } : {}),
  };
  ws.headerFooter = { oddFooter: "&L&8SIG-Palma&R&8Página &P de &N" };
}
