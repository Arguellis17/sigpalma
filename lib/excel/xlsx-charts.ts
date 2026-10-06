import JSZip from "jszip";

/**
 * ExcelJS no genera gráficos. Este módulo inyecta gráficos nativos de Excel (DrawingML)
 * en el .xlsx ya generado: drawing + chart + relaciones + [Content_Types].
 * Los gráficos referencian rangos reales de celdas y llevan caché de valores,
 * así se editan en Excel y se ven en visores que no recalculan.
 *
 * ponytail: solo columnas/barras + líneas (eje secundario opcional). Añadir tipos cuando se pidan.
 */

export type ChartSeries = {
  /** Encabezado de la serie, p. ej. `'Por lote'!$H$4`. */
  nameRef: string;
  name: string;
  /** Rango de valores, p. ej. `'Por lote'!$H$5:$H$9`. */
  valuesRef: string;
  values: number[];
  color: string;
  /** Formato de las etiquetas de datos; omitir para ocultarlas. */
  labelFormat?: string;
};

export type ChartSpec = {
  /** Hoja donde se dibuja el gráfico. */
  sheetName: string;
  title: string;
  /** Celdas 0-based: columna/fila superior izquierda e inferior derecha. */
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
  categoriesRef: string;
  categories: string[];
  /** "col" = columnas verticales, "bar" = barras horizontales. */
  barDir?: "col" | "bar";
  bars: ChartSeries[];
  lines?: ChartSeries[];
  /** Si true, las líneas usan un eje Y secundario (derecha). */
  linesOnSecondaryAxis?: boolean;
  valueAxisTitle?: string;
  secondaryAxisTitle?: string;
  valueAxisFormat?: string;
  secondaryAxisFormat?: string;
};

const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_DRAWING = `${NS_REL}/drawing`;
const REL_CHART = `${NS_REL}/chart`;
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";
const CT_CHART = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Referencia absoluta a rango: sheetRef("Por lote", "B", 5, 9) → `'Por lote'!$B$5:$B$9`. */
export function sheetRef(sheet: string, col: string, fromRow: number, toRow = fromRow): string {
  const quoted = `'${sheet.replace(/'/g, "''")}'`;
  const a = `$${col}$${fromRow}`;
  return fromRow === toRow ? `${quoted}!${a}` : `${quoted}!${a}:$${col}$${toRow}`;
}

function richText(text: string, size: number, bold: boolean, color = "404040"): string {
  return `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="es-CO" sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${escapeXml(text)}</a:t></a:r></a:p></c:rich></c:tx>`;
}

function titleXml(text: string, size: number): string {
  return `<c:title>${richText(text, size, size >= 1200)}<c:overlay val="0"/></c:title>`;
}

function textProps(size: number, color = "595959"): string {
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr>`;
}

function strCache(values: string[]): string {
  const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join("");
  return `<c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache>`;
}

function numCache(values: number[]): string {
  const pts = values
    .map((v, i) => (Number.isFinite(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : ""))
    .join("");
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache>`;
}

function dataLabels(format: string | undefined, pos: "outEnd" | "inBase" | "t"): string {
  if (!format) return "";
  // Dentro de la barra (combinado con línea) el texto va en blanco para no chocar con los marcadores.
  const color = pos === "inBase" ? "FFFFFF" : "404040";
  return `<c:dLbls><c:numFmt formatCode="${escapeXml(format)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${textProps(800, color)}<c:dLblPos val="${pos}"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`;
}

function seriesXml(
  s: ChartSeries,
  idx: number,
  kind: "bar" | "line",
  spec: ChartSpec
): string {
  const head = `<c:idx val="${idx}"/><c:order val="${idx}"/><c:tx><c:strRef><c:f>${escapeXml(s.nameRef)}</c:f>${strCache([s.name])}</c:strRef></c:tx>`;
  const cat = `<c:cat><c:strRef><c:f>${escapeXml(spec.categoriesRef)}</c:f>${strCache(spec.categories)}</c:strRef></c:cat>`;
  const val = `<c:val><c:numRef><c:f>${escapeXml(s.valuesRef)}</c:f>${numCache(s.values)}</c:numRef></c:val>`;
  if (kind === "bar") {
    const pos = spec.lines?.length ? "inBase" : "outEnd";
    return `<c:ser>${head}<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${dataLabels(s.labelFormat, pos)}${cat}${val}</c:ser>`;
  }
  return `<c:ser>${head}<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:marker>${dataLabels(s.labelFormat, "t")}${cat}${val}<c:smooth val="0"/></c:ser>`;
}

function catAxXml(id: number, crossId: number, pos: string, opts: { hidden?: boolean; reverse?: boolean }): string {
  return `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="${opts.reverse ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="${opts.hidden ? 1 : 0}"/><c:axPos val="${pos}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr>${textProps(900)}<c:crossAx val="${crossId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
}

function valAxXml(
  id: number,
  crossId: number,
  pos: string,
  opts: { title?: string; format?: string; gridlines?: boolean; crosses?: "autoZero" | "max" }
): string {
  const grid = opts.gridlines
    ? `<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E7E6E6"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>`
    : "";
  const title = opts.title ? titleXml(opts.title, 900) : "";
  return `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${grid}${title}<c:numFmt formatCode="${escapeXml(opts.format ?? "General")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${textProps(900)}<c:crossAx val="${crossId}"/><c:crosses val="${opts.crosses ?? "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;
}

export function buildChartXml(spec: ChartSpec): string {
  const barDir = spec.barDir ?? "col";
  const horizontal = barDir === "bar";
  const lines = spec.lines ?? [];
  const secondary = lines.length > 0 && spec.linesOnSecondaryAxis === true;

  const bars = spec.bars.map((s, i) => seriesXml(s, i, "bar", spec)).join("");
  const barChart = `<c:barChart><c:barDir val="${barDir}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${bars}<c:gapWidth val="70"/><c:axId val="10"/><c:axId val="20"/></c:barChart>`;

  const lineSeries = lines
    .map((s, i) => seriesXml(s, spec.bars.length + i, "line", spec))
    .join("");
  const lineChart = lines.length
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSeries}<c:marker val="1"/><c:axId val="${secondary ? 30 : 10}"/><c:axId val="${secondary ? 40 : 20}"/></c:lineChart>`
    : "";

  // Barras horizontales: categorías de arriba a abajo en el orden de la tabla.
  const axes =
    catAxXml(10, 20, horizontal ? "l" : "b", { reverse: horizontal }) +
    valAxXml(20, 10, horizontal ? "b" : "l", {
      title: spec.valueAxisTitle,
      format: spec.valueAxisFormat,
      gridlines: true,
      crosses: horizontal ? "max" : "autoZero",
    }) +
    (secondary
      ? catAxXml(30, 40, "b", { hidden: true }) +
        valAxXml(40, 30, "r", {
          title: spec.secondaryAxisTitle,
          format: spec.secondaryAxisFormat,
          crosses: "max",
        })
      : "");

  const showLegend = spec.bars.length + lines.length > 1;
  const legend = showLegend
    ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${textProps(900)}</c:legend>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_REL}"><c:date1904 val="0"/><c:lang val="es-CO"/><c:roundedCorners val="0"/><c:chart>${titleXml(spec.title, 1300)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${barChart}${lineChart}${axes}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function anchorXml(spec: ChartSpec, idx: number, relId: string): string {
  const { fromCol, fromRow, toCol, toRow } = spec.anchor;
  return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${idx + 2}" name="${escapeXml(spec.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${relId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

function relsXml(rels: { id: string; type: string; target: string }[]): string {
  const body = rels
    .map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

/** Resuelve "Resumen" → "xl/worksheets/sheet1.xml" leyendo workbook.xml y sus rels. */
async function resolveSheetPath(zip: JSZip, sheetName: string): Promise<string> {
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  const wbRels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const sheetTag = [...wb.matchAll(/<sheet\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => tag.includes(`name="${escapeXml(sheetName)}"`));
  const rid = sheetTag?.match(/r:id="([^"]+)"/)?.[1];
  if (!rid) throw new Error(`Hoja no encontrada: ${sheetName}`);
  const relTag = [...wbRels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => tag.includes(`Id="${rid}"`));
  const target = relTag?.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new Error(`Relación de hoja no encontrada: ${sheetName}`);
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}

/** Inyecta los gráficos en un .xlsx generado por ExcelJS y devuelve el nuevo buffer. */
export async function addChartsToXlsx(xlsx: Buffer | ArrayBuffer, charts: ChartSpec[]): Promise<Buffer> {
  if (charts.length === 0) {
    return Buffer.isBuffer(xlsx) ? xlsx : Buffer.from(xlsx);
  }
  const zip = await JSZip.loadAsync(xlsx);

  if (Object.keys(zip.files).some((f) => f.startsWith("xl/drawings/"))) {
    // ExcelJS solo crea drawings con imágenes; no mezclamos ambos mecanismos.
    throw new Error("El libro ya contiene dibujos; no se pueden inyectar gráficos.");
  }

  let contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  const overrides: string[] = [];

  const bySheet = new Map<string, ChartSpec[]>();
  for (const c of charts) {
    bySheet.set(c.sheetName, [...(bySheet.get(c.sheetName) ?? []), c]);
  }

  let chartNo = 0;
  let drawingNo = 0;
  for (const [sheetName, specs] of bySheet) {
    drawingNo += 1;
    const sheetPath = await resolveSheetPath(zip, sheetName);
    const sheetFile = sheetPath.split("/").pop()!;
    const sheetRelsPath = sheetPath.replace(sheetFile, `_rels/${sheetFile}.rels`);

    const drawingRels: { id: string; type: string; target: string }[] = [];
    const anchors: string[] = [];
    specs.forEach((spec, i) => {
      chartNo += 1;
      const relId = `rId${i + 1}`;
      zip.file(`xl/charts/chart${chartNo}.xml`, buildChartXml(spec));
      overrides.push(`<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="${CT_CHART}"/>`);
      drawingRels.push({ id: relId, type: REL_CHART, target: `../charts/chart${chartNo}.xml` });
      anchors.push(anchorXml(spec, i, relId));
    });

    zip.file(
      `xl/drawings/drawing${drawingNo}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_REL}">${anchors.join("")}</xdr:wsDr>`
    );
    zip.file(`xl/drawings/_rels/drawing${drawingNo}.xml.rels`, relsXml(drawingRels));
    overrides.push(`<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="${CT_DRAWING}"/>`);

    // Relación hoja → drawing (anexar si ExcelJS ya creó rels, p. ej. por hipervínculos).
    const existingRels = zip.file(sheetRelsPath) ? await zip.file(sheetRelsPath)!.async("string") : null;
    let drawingRelId = "rIdChartDrawing";
    if (existingRels) {
      while (existingRels.includes(`Id="${drawingRelId}"`)) drawingRelId += "x";
      zip.file(
        sheetRelsPath,
        existingRels.replace(
          "</Relationships>",
          `<Relationship Id="${drawingRelId}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingNo}.xml"/></Relationships>`
        )
      );
    } else {
      zip.file(
        sheetRelsPath,
        relsXml([{ id: drawingRelId, type: REL_DRAWING, target: `../drawings/drawing${drawingNo}.xml` }])
      );
    }

    // <drawing> va antes de legacyDrawing/picture/tableParts/extLst según el esquema SpreadsheetML.
    let sheetXml = await zip.file(sheetPath)!.async("string");
    if (!/<worksheet\b[^>]*xmlns:r=/.test(sheetXml)) {
      sheetXml = sheetXml.replace("<worksheet", `<worksheet xmlns:r="${NS_REL}"`);
    }
    const drawingTag = `<drawing r:id="${drawingRelId}"/>`;
    const before = sheetXml.search(/<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/);
    sheetXml =
      before >= 0
        ? sheetXml.slice(0, before) + drawingTag + sheetXml.slice(before)
        : sheetXml.replace("</worksheet>", `${drawingTag}</worksheet>`);
    zip.file(sheetPath, sheetXml);
  }

  contentTypes = contentTypes.replace("</Types>", `${overrides.join("")}</Types>`);
  zip.file("[Content_Types].xml", contentTypes);

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}
