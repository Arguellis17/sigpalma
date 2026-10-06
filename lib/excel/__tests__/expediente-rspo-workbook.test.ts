import { describe, expect, it } from "vitest";
import {
  HOJA_COSECHA_DESPACHO,
  HOJA_EXPEDIENTE,
  HOJA_LINEA_VIDA,
  buildExpedienteRspoWorkbook,
  etiquetaCampo,
  resumirMetadata,
} from "@/lib/excel/expediente-rspo-workbook";
import type { ExpedienteRspoPdfData } from "@/lib/pdf/expediente-rspo-types";
import { validarCompletitudExpediente } from "@/lib/trazabilidad/expediente-rspo";
import type { TimelineEvent, TimelineEventCategory } from "@/lib/trazabilidad/types";
import { sinCodigosInternos } from "@/lib/excel/estilos";
import { cellText, expectSinCodigosInternos, openXlsx, sheetTexts } from "./helpers";

const cosecha = (id: string, fecha: string, kg: number): TimelineEvent => ({
  id: `cosecha:${id}`,
  category: "cosecha",
  sortAt: `${fecha}T12:00:00.000Z`,
  displayDate: fecha,
  title: "Cosecha RFF",
  subtitle: `${kg / 1000} t`,
  metadata: { tipo: "cosecha_rff", pesoKg: kg, conteoRacimos: 20, rendimientoTonHa: kg / 1000 / 500, observaciones: null, cosechaId: id },
});

const remision: TimelineEvent = {
  id: "logistica:r1",
  category: "logistica",
  sortAt: "2026-06-21T14:00:00.000Z",
  displayDate: "2026-06-21",
  title: "Remisión REM-0001",
  subtitle: "Placa ABC123",
  metadata: {
    tipo: "remision_despacho",
    remisionId: "r1",
    numeroRemision: "REM-0001",
    placa: "ABC123",
    conductorId: "1090",
    conductorNombre: "Pedro Pérez",
    pesoTotalKg: 60,
    destino: "Extractora Norte",
  },
};

function data(eventos: TimelineEvent[]): ExpedienteRspoPdfData {
  const conteo = Object.fromEntries(
    ["material_plan", "vivero", "labor", "nutricion", "sanidad", "suelo", "cosecha", "logistica"].map((k) => [k, 0])
  ) as Record<TimelineEventCategory, number>;
  for (const e of eventos) conteo[e.category] += 1;
  const trazabilidad = {
    lote: {
      id: "l1",
      codigo: "L-04",
      finca_id: "f",
      area_ha: 500,
      activo: true,
      estado_cultivo: "produccion",
      material_genetico: "Tenera",
      anio_siembra: 2020,
    },
    eventos,
    resumen: {
      materialDeclarado: "Tenera",
      estadoCultivo: "produccion",
      ultimaCosecha: null,
      rendimientoPromedioFinca: 0.1,
      cosechasEnLote: eventos.filter((e) => e.category === "cosecha").length,
      tendenciaTexto: null,
      ultimaAlertaFuerte: null,
      conteoPorCategoria: conteo,
    },
  };
  return {
    finca_nombre: "UFPS",
    lote_codigo: "L-04",
    area_ha: 500,
    material_genetico: "Tenera",
    anio_siembra: 2020,
    estado_cultivo: "produccion",
    fecha_generacion: "06/10/2026",
    advertencias: validarCompletitudExpediente(trazabilidad),
    trazabilidad,
  };
}

const GENERADO = new Date("2026-10-06T19:30:00Z");

describe("buildExpedienteRspoWorkbook", () => {
  it("crea Expediente, Línea de vida y Cosecha y despacho", async () => {
    const { wb } = await openXlsx(await buildExpedienteRspoWorkbook(data([remision]), GENERADO));
    expect(wb.worksheets.map((w) => w.name)).toEqual([HOJA_EXPEDIENTE, HOJA_LINEA_VIDA, HOJA_COSECHA_DESPACHO]);
  });

  it("Expediente: ficha del lote, advertencias de completitud y conteo por categoría con total", async () => {
    const d = data([cosecha("c1", "2026-06-06", 50)]);
    const { wb } = await openXlsx(await buildExpedienteRspoWorkbook(d, GENERADO));
    const ws = wb.getWorksheet(HOJA_EXPEDIENTE)!;
    expect(cellText(ws, "A1")).toBe("Expediente de trazabilidad RSPO");
    expect(cellText(ws, "A2")).toBe("UFPS · Lote L-04");
    const textos = sheetTexts(ws);
    expect(textos).toContain("Tenera");
    // Cosecha sin remisión → advertencia en ámbar, sin códigos internos (RN25 / HU29).
    const aviso = textos.find((t) => t.startsWith("⚠") && t.includes("remisión de despacho"));
    expect(aviso).toBe(
      "⚠ Hay cosecha registrada pero no consta remisión de despacho. Genere remisión."
    );
    expect(textos).not.toContain("✔ Cadena de datos completa para exportación.");

    let totalRow = 0;
    ws.eachRow((row, n) => {
      if (row.getCell(1).value === "TOTAL") totalRow = n;
    });
    expect(ws.getCell(`B${totalRow}`).value).toMatchObject({ result: 1 });
    expect(cellText(ws, `A${totalRow - 2}`)).toBe("Cosecha");
    expect(ws.getCell(`B${totalRow - 2}`).value).toBe(1);
  });

  it("Línea de vida incluye TODOS los eventos (sin el tope de 80 del PDF), en orden descendente", async () => {
    const eventos = Array.from({ length: 120 }, (_, i) =>
      cosecha(`c${i}`, `2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, "0")}`, 10 + i)
    );
    const { wb } = await openXlsx(await buildExpedienteRspoWorkbook(data(eventos), GENERADO));
    const ws = wb.getWorksheet(HOJA_LINEA_VIDA)!;
    expect(ws.actualRowCount).toBe(4 + 120);
    const fechas = Array.from({ length: 120 }, (_, i) => (ws.getCell(5 + i, 1).value as Date).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    expect(ws.getCell("A5").numFmt).toBe("dd/mm/yyyy");
    expect(ws.autoFilter).toBeTruthy();
  });

  it("Línea de vida: metadatos legibles y el ID del registro en su propia columna", async () => {
    const { wb } = await openXlsx(await buildExpedienteRspoWorkbook(data([remision]), GENERADO));
    const ws = wb.getWorksheet(HOJA_LINEA_VIDA)!;
    expect(cellText(ws, "B5")).toBe("Despacho");
    expect(cellText(ws, "E5")).toContain("Numero remision: REM-0001");
    expect(cellText(ws, "E5")).not.toContain("remision_despacho");
    expect(cellText(ws, "F5")).toBe("r1");
  });

  it("Cosecha y despacho: cosechas con totales y remisiones con conductor y destino", async () => {
    const d = data([cosecha("c1", "2026-06-06", 50), cosecha("c2", "2026-06-20", 10), remision]);
    const { wb } = await openXlsx(await buildExpedienteRspoWorkbook(d, GENERADO));
    const ws = wb.getWorksheet(HOJA_COSECHA_DESPACHO)!;
    const textos = sheetTexts(ws);
    expect(textos).toContain("Cosechas RFF (2)".toUpperCase());
    expect(textos).toContain("REM-0001");
    expect(textos).toContain("Pedro Pérez");
    expect(textos).toContain("Extractora Norte");
    let total = 0;
    ws.eachRow((row, n) => {
      if (row.getCell(1).value === "TOTAL") total = n;
    });
    expect(ws.getCell(`B${total}`).value).toMatchObject({ result: 60 });
    // t/ha exacto por fórmula (50 kg / 500 ha), con 6 decimales para no mostrarse como 0.
    const fila = total - 2;
    expect(ws.getCell(`E${fila}`).value).toEqual({ formula: `IF(500=0,0,C${fila}/500)`, result: 0.0001 });
    expect(ws.getCell(`E${fila}`).numFmt).toBe("#,##0.000000");
  });

  it("estado del cultivo legible en la ficha", async () => {
    const { wb } = await openXlsx(
      await buildExpedienteRspoWorkbook({ ...data([]), estado_cultivo: "en_produccion" }, GENERADO)
    );
    expect(sheetTexts(wb.getWorksheet(HOJA_EXPEDIENTE)!)).toContain("En producción");
  });

  it("gráfico nativo de barras horizontales sobre la tabla de categorías", async () => {
    const { charts, read } = await openXlsx(await buildExpedienteRspoWorkbook(data([remision]), GENERADO));
    expect(charts).toHaveLength(1);
    const xml = await read(charts[0]);
    expect(xml).toContain("Eventos de trazabilidad por categoría");
    expect(xml).toContain('<c:barDir val="bar"/>');
    expect(xml).toMatch(/&apos;Expediente&apos;!\$B\$\d+:\$B\$\d+/);
    expect(xml).toContain("<c:v>Despacho</c:v>");
  });

  it("lote sin eventos: libro válido con avisos", async () => {
    const { wb } = await openXlsx(await buildExpedienteRspoWorkbook(data([]), GENERADO));
    expect(sheetTexts(wb.getWorksheet(HOJA_LINEA_VIDA)!)).toContain("El lote no tiene eventos registrados.");
    expect(sheetTexts(wb.getWorksheet(HOJA_COSECHA_DESPACHO)!)).toContain(
      "Sin remisiones de despacho asociadas al lote."
    );
  });
});

describe("sin códigos internos", () => {
  it("el libro no muestra HU/RN/CU/RF aunque los datos de la app los traigan", async () => {
    const conCodigos: TimelineEvent = {
      ...cosecha("c9", "2026-07-01", 30),
      title: "Cosecha RFF (HU27)",
      subtitle: "Validada según RN21 · RN22",
      metadata: { tipo: "cosecha_rff", pesoKg: 30, conteoRacimos: 5, notas: "Ver CU09.1 y RF08" },
    };
    await expectSinCodigosInternos(await buildExpedienteRspoWorkbook(data([conCodigos]), GENERADO));
  });

  it("sinCodigosInternos limpia paréntesis, listas y códigos sueltos", () => {
    expect(sinCodigosInternos("Sin remisión (RN25). Genere remisión HU29.")).toBe(
      "Sin remisión. Genere remisión."
    );
    expect(sinCodigosInternos("Resumen (RN21 · RSPO)")).toBe("Resumen (RSPO)");
    expect(sinCodigosInternos("Firma (CU09.1) y RNF-03 activos")).toBe("Firma y activos");
    expect(sinCodigosInternos("Lote L-04 · 0.040 t")).toBe("Lote L-04 · 0.040 t");
  });
});

describe("helpers de metadatos", () => {
  it("etiquetaCampo humaniza camelCase y snake_case", () => {
    expect(etiquetaCampo("pesoTotalKg")).toBe("Peso total kg");
    expect(etiquetaCampo("dosis_ha")).toBe("Dosis ha");
  });

  it("resumirMetadata omite tipo, IDs y vacíos; traduce booleanos", () => {
    expect(
      resumirMetadata({ tipo: "x", cosechaId: "1", pesoKg: 5, notas: "", ok: true, nada: null })
    ).toBe("Peso kg: 5 · Ok: Sí");
  });
});
