import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { addChartsToXlsx, buildChartXml, escapeXml, sheetRef, type ChartSpec } from "@/lib/excel/xlsx-charts";
import { expectWellFormedXml, openXlsx } from "./helpers";

async function baseWorkbook() {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("Resumen");
  a.getCell("A1").value = "x";
  a.pageSetup = { orientation: "landscape" };
  const b = wb.addWorksheet("Por lote");
  b.getRow(1).values = ["Lote", "t/ha"];
  b.getRow(2).values = ["L-01", 1.5];
  b.getRow(3).values = ["L-02", 2.25];
  b.getCell("D1").value = { text: "link", hyperlink: "https://example.com" };
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

const spec = (over: Partial<ChartSpec> = {}): ChartSpec => ({
  sheetName: "Resumen",
  title: "Rendimiento & <calidad>",
  anchor: { fromCol: 0, fromRow: 2, toCol: 6, toRow: 20 },
  categoriesRef: sheetRef("Por lote", "A", 2, 3),
  categories: ["L-01", "L-02"],
  bars: [
    {
      name: "t/ha",
      nameRef: sheetRef("Por lote", "B", 1),
      valuesRef: sheetRef("Por lote", "B", 2, 3),
      values: [1.5, 2.25],
      color: "2E9E6B",
      labelFormat: "0.000",
    },
  ],
  ...over,
});

describe("sheetRef / escapeXml", () => {
  it("genera referencias absolutas con comillas y escapa apóstrofos", () => {
    expect(sheetRef("Por lote", "H", 5, 9)).toBe("'Por lote'!$H$5:$H$9");
    expect(sheetRef("Por lote", "H", 4)).toBe("'Por lote'!$H$4");
    expect(sheetRef("O'Brien", "A", 1)).toBe("'O''Brien'!$A$1");
  });

  it("escapa los cinco caracteres reservados de XML", () => {
    expect(escapeXml(`a&b<c>"d"'e'`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;");
  });
});

describe("buildChartXml", () => {
  it("produce XML bien formado con referencias y caché de valores", () => {
    const xml = buildChartXml(spec());
    expectWellFormedXml(xml, "chart");
    expect(xml).toContain("<c:barDir val=\"col\"/>");
    expect(xml).toContain("<c:f>&apos;Por lote&apos;!$B$2:$B$3</c:f>");
    expect(xml).toContain('<c:pt idx="1"><c:v>2.25</c:v></c:pt>');
    expect(xml).toContain("<a:t>Rendimiento &amp; &lt;calidad&gt;</a:t>");
    expect(xml).not.toContain("<c:lineChart>");
    expect(xml).not.toContain("<c:legend>"); // una sola serie: sin leyenda
  });

  it("combina barras + línea en eje secundario con leyenda", () => {
    const xml = buildChartXml(
      spec({
        lines: [{ ...spec().bars[0], name: "Promedio", color: "E8833A", labelFormat: undefined }],
        linesOnSecondaryAxis: true,
        secondaryAxisTitle: "t/ha",
      })
    );
    expectWellFormedXml(xml, "chart");
    expect(xml).toContain("<c:lineChart>");
    expect(xml.match(/<c:valAx>/g)).toHaveLength(2);
    expect(xml).toContain('<c:axPos val="r"/>');
    expect(xml).toContain("<c:legend>");
    // Etiquetas de barra dentro de la base para no chocar con los marcadores de la línea.
    expect(xml).toContain('<c:dLblPos val="inBase"/>');
  });

  it("barras horizontales invierten el eje de categorías para conservar el orden de la tabla", () => {
    const xml = buildChartXml(spec({ barDir: "bar" }));
    expect(xml).toContain('<c:barDir val="bar"/>');
    expect(xml).toContain('<c:orientation val="maxMin"/>');
  });

  it("omite puntos no numéricos en la caché", () => {
    const xml = buildChartXml(spec({ bars: [{ ...spec().bars[0], values: [1, Number.NaN] }] }));
    expect(xml).toContain('<c:ptCount val="2"/><c:pt idx="0"><c:v>1</c:v></c:pt></c:numCache>');
  });
});

describe("addChartsToXlsx", () => {
  it("inyecta drawings, charts, relaciones y content types; ExcelJS puede releer el libro", async () => {
    const out = await addChartsToXlsx(await baseWorkbook(), [
      spec(),
      spec({ title: "Segundo", anchor: { fromCol: 7, fromRow: 2, toCol: 12, toRow: 20 } }),
      spec({ sheetName: "Por lote", title: "En otra hoja" }),
    ]);
    const { files, read, charts, wb } = await openXlsx(out);

    expect(charts).toEqual(["xl/charts/chart1.xml", "xl/charts/chart2.xml", "xl/charts/chart3.xml"]);
    expect(files).toContain("xl/drawings/drawing1.xml");
    expect(files).toContain("xl/drawings/drawing2.xml");

    const ct = await read("[Content_Types].xml");
    expect(ct.match(/drawingml\.chart\+xml/g)).toHaveLength(3);
    expect(ct.match(/drawing\+xml/g)).toHaveLength(2);

    const drawing1 = await read("xl/drawings/drawing1.xml");
    expect(drawing1.match(/<xdr:twoCellAnchor/g)).toHaveLength(2);
    const d1rels = await read("xl/drawings/_rels/drawing1.xml.rels");
    expect(d1rels).toContain('Target="../charts/chart1.xml"');
    expect(d1rels).toContain('Target="../charts/chart2.xml"');

    // Hoja 1: <drawing> antes de </worksheet> y después de pageSetup (orden del esquema).
    const s1 = await read("xl/worksheets/sheet1.xml");
    expect(s1.indexOf("<drawing ")).toBeGreaterThan(s1.indexOf("<pageSetup"));
    expect(await read("xl/worksheets/_rels/sheet1.xml.rels")).toContain("../drawings/drawing1.xml");

    // Hoja 2 ya tenía rels (hipervínculo): se anexa sin perderlo.
    const s2rels = await read("xl/worksheets/_rels/sheet2.xml.rels");
    expect(s2rels).toContain("hyperlink");
    expect(s2rels).toContain("../drawings/drawing2.xml");

    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumen", "Por lote"]);
    expect(wb.getWorksheet("Por lote")!.getCell("B3").value).toBe(2.25);
  });

  it("sin gráficos devuelve un libro válido sin drawings", async () => {
    const { files } = await openXlsx(await addChartsToXlsx(await baseWorkbook(), []));
    expect(files.some((f) => f.startsWith("xl/drawings/"))).toBe(false);
  });

  it("falla con mensaje claro si la hoja no existe", async () => {
    await expect(addChartsToXlsx(await baseWorkbook(), [spec({ sheetName: "Nope" })])).rejects.toThrow(
      "Hoja no encontrada: Nope"
    );
  });
});
