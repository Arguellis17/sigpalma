import ExcelJS from "exceljs";
import JSZip from "jszip";
import { expect } from "vitest";

/** Comprueba que el XML esté bien formado (etiquetas balanceadas, & escapados). */
export function expectWellFormedXml(xml: string, part = "xml") {
  const body = xml.replace(/<\?xml[^>]*\?>/, "");
  const stack: string[] = [];
  for (const m of body.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)(?:\s[^>]*?)?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) {
      const top = stack.pop();
      expect(top, `${part}: </${name}> cierra <${top}>`).toBe(name);
    } else {
      stack.push(name);
    }
  }
  expect(stack, `${part}: etiquetas sin cerrar`).toEqual([]);
  expect(body, `${part}: '&' sin escapar`).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/);
}

export async function openXlsx(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const read = (path: string) => zip.file(path)!.async("string");
  const files = Object.keys(zip.files);
  const charts = files.filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f)).sort();
  for (const f of files.filter((f) => f.endsWith(".xml") || f.endsWith(".rels"))) {
    expectWellFormedXml(await read(f), f);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return { zip, files, read, charts, wb };
}

export function cellText(ws: ExcelJS.Worksheet, ref: string): string {
  const v = ws.getCell(ref).value;
  if (v && typeof v === "object" && "formula" in v) return String(v.result ?? "");
  return v == null ? "" : String(v);
}

/** Ningún texto visible del libro (celdas y gráficos) debe mencionar códigos HU/RN/CU/RF. */
export async function expectSinCodigosInternos(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const partes = Object.keys(zip.files).filter((f) =>
    /^xl\/(sharedStrings|worksheets\/sheet\d+|charts\/chart\d+)\.xml$/.test(f)
  );
  for (const f of partes) {
    const xml = await zip.file(f)!.async("string");
    expect(xml, f).not.toMatch(/\b(?:RNF|HU|RN|CU|RF)-?\d+/);
  }
}

/** Todas las celdas de texto de la hoja, para buscar mensajes. */
export function sheetTexts(ws: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  ws.eachRow((row) => row.eachCell((c) => typeof c.value === "string" && out.push(c.value)));
  return out;
}
