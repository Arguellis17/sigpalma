import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildLiquidacionJornalesWorkbook,
  HOJA_DETALLE_JORNALES,
  HOJA_RESUMEN_JORNALES,
} from "@/lib/excel/liquidacion-jornales-workbook";
import {
  consolidarPorTrabajador,
  formatCantidadPago,
  idFila,
  tarifasFaltantes,
  totalLiquidacion,
  type FilaLiquidacion,
} from "@/lib/jornales";
import { anularLiquidacionSchema, guardarTarifaSchema, periodoLiquidacionSchema } from "@/lib/validations/jornales";

const U = "3f2b8c1e-5a4d-4e6f-9b1a-7c8d9e0f1a2b";

function fila(p: Partial<FilaLiquidacion>): FilaLiquidacion {
  return {
    labor_id: Math.random().toString(36),
    trabajador_id: "t1",
    trabajador_nombre: "Ana",
    trabajador_documento: "123",
    labor_nombre: "Poda",
    lote_codigo: "L-01",
    fecha: "2026-11-02",
    cantidad: 10,
    unidad_medida: "palmas",
    valor_unitario: 1000,
    subtotal: 10000,
    ...p,
  };
}

describe("consolidarPorTrabajador", () => {
  it("agrupa y suma por trabajador, ordenado por nombre", () => {
    const r = consolidarPorTrabajador([
      fila({ trabajador_id: "t2", trabajador_nombre: "Zoe", subtotal: 500 }),
      fila({ subtotal: 100 }),
      fila({ subtotal: 200 }),
    ]);
    expect(r.map((t) => [t.trabajador_nombre, t.labores, t.total])).toEqual([
      ["Ana", 2, 300],
      ["Zoe", 1, 500],
    ]);
  });

  it("no acumula error de punto flotante", () => {
    const filas = Array.from({ length: 3 }, () => fila({ subtotal: 0.1 }));
    expect(consolidarPorTrabajador(filas)[0].total).toBe(0.3);
    expect(totalLiquidacion(filas)).toBe(0.3);
  });

  it("cuenta las labores sin tarifa y no las suma", () => {
    const [t] = consolidarPorTrabajador([fila({ subtotal: 100 }), fila({ valor_unitario: null, subtotal: null })]);
    expect(t.total).toBe(100);
    expect(t.sin_tarifa).toBe(1);
    expect(t.labores).toBe(2);
  });

  it("dos personas con el mismo nombre no se mezclan", () => {
    const r = consolidarPorTrabajador([fila({ trabajador_id: "a" }), fila({ trabajador_id: "b" })]);
    expect(r).toHaveLength(2);
  });
});

describe("tarifasFaltantes", () => {
  it("agrupa por labor y unidad con la fecha más antigua", () => {
    const sin = { valor_unitario: null, subtotal: null };
    const r = tarifasFaltantes([
      fila({ ...sin, fecha: "2026-11-05" }),
      fila({ ...sin, fecha: "2026-11-01" }),
      fila({ ...sin, unidad_medida: "ha" }),
      fila({}),
    ]);
    expect(r).toHaveLength(2);
    const palmas = r.find((x) => x.unidad_medida === "palmas");
    expect(palmas).toMatchObject({ desde: "2026-11-01", labores: 2 });
  });

  it("vacío si todo tiene tarifa", () => {
    expect(tarifasFaltantes([fila({})])).toEqual([]);
  });
});

describe("formas de pago", () => {
  it("texto de cantidades", () => {
    expect(formatCantidadPago(10, "palmas")).toBe("10 palmas");
    expect(formatCantidadPago(1, "jornal")).toBe("1 jornal");
    expect(formatCantidadPago(0, "jornal")).toBe("Incluida en el jornal del día");
    expect(formatCantidadPago(1, "ha")).toBe("1 hectárea");
    expect(formatCantidadPago(500, "kg")).toBe("500 kg");
    expect(formatCantidadPago(20, "racimo")).toBe("20 racimos");
  });

  it("una labor del mismo día ya pagado por jornal no suma", () => {
    const [t] = consolidarPorTrabajador([
      fila({ unidad_medida: "jornal", cantidad: 1, valor_unitario: 60000, subtotal: 60000 }),
      fila({ unidad_medida: "jornal", cantidad: 0, valor_unitario: 60000, subtotal: 0 }),
    ]);
    expect(t.total).toBe(60000);
    expect(t.labores).toBe(2);
    expect(t.sin_tarifa).toBe(0);
  });

  it("filas de cosecha se identifican por la cosecha", () => {
    expect(idFila({ labor_id: null, cosecha_id: "c1" })).toBe("c1");
    expect(idFila({ labor_id: "l1", cosecha_id: null })).toBe("l1");
  });
});

describe("validaciones de jornales", () => {
  it("la tarifa debe ser positiva y de unidad conocida", () => {
    const t = { catalogo_item_id: U, unidad_medida: "palmas", valor_unitario: 500, vigente_desde: "2026-11-01" };
    expect(guardarTarifaSchema.safeParse(t).success).toBe(true);
    expect(guardarTarifaSchema.safeParse({ ...t, valor_unitario: 0 }).success).toBe(false);
    expect(guardarTarifaSchema.safeParse({ ...t, unidad_medida: "litros" }).success).toBe(false);
  });

  it("jornal va con labor; kilo y racimo solo para la cosecha, sin labor", () => {
    const t = { valor_unitario: 500, vigente_desde: "2026-11-01" };
    expect(guardarTarifaSchema.safeParse({ ...t, catalogo_item_id: U, unidad_medida: "jornal" }).success).toBe(true);
    expect(guardarTarifaSchema.safeParse({ ...t, catalogo_item_id: null, unidad_medida: "kg" }).success).toBe(true);
    expect(guardarTarifaSchema.safeParse({ ...t, catalogo_item_id: null, unidad_medida: "racimo" }).success).toBe(true);
    expect(guardarTarifaSchema.safeParse({ ...t, catalogo_item_id: U, unidad_medida: "kg" }).success).toBe(false);
    expect(guardarTarifaSchema.safeParse({ ...t, catalogo_item_id: null, unidad_medida: "jornal" }).success).toBe(false);
  });

  it("el periodo no puede invertirse; un solo día es válido", () => {
    expect(periodoLiquidacionSchema.safeParse({ desde: "2026-11-02", hasta: "2026-11-01" }).success).toBe(false);
    expect(periodoLiquidacionSchema.safeParse({ desde: "2026-11-02", hasta: "2026-11-02" }).success).toBe(true);
  });

  it("anular exige motivo de al menos 10 caracteres, sin contar espacios", () => {
    expect(anularLiquidacionSchema.safeParse({ id: U, motivo: "corto" }).success).toBe(false);
    expect(anularLiquidacionSchema.safeParse({ id: U, motivo: "   corto       " }).success).toBe(false);
    expect(anularLiquidacionSchema.safeParse({ id: U, motivo: "Tarifa mal digitada" }).success).toBe(true);
  });
});

describe("Excel de la liquidación", () => {
  const datos = {
    consecutivo: 7,
    finca_nombre: "UFPS",
    periodo_desde: "2026-11-01",
    periodo_hasta: "2026-11-30",
    is_voided: false,
    motivo_anulacion: null,
    filas: [
      fila({ trabajador_nombre: "Zoe", trabajador_id: "t2", cantidad: 3, valor_unitario: 1000, subtotal: 3000 }),
      fila({ cantidad: 2, valor_unitario: 500, subtotal: 1000 }),
      fila({ cantidad: 4, valor_unitario: 250, subtotal: 1000 }),
    ],
  };

  async function abrir(d = datos) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildLiquidacionJornalesWorkbook(d)) as never);
    return wb;
  }
  const res = (c: ExcelJS.Cell) => (c.value as { result: unknown }).result;

  it("resumen por trabajador con fórmulas y total", async () => {
    const r = (await abrir()).getWorksheet(HOJA_RESUMEN_JORNALES)!;
    expect(r.getCell("A5").value).toBe("Ana");
    expect(res(r.getCell("C5"))).toBe(2);
    expect(res(r.getCell("D5"))).toBe(2000);
    expect((r.getCell("D5").value as { formula: string }).formula).toBe(`SUM(${HOJA_DETALLE_JORNALES}!$I$5:$I$6)`);
    expect((r.getCell("D6").value as { formula: string }).formula).toBe(`SUM(${HOJA_DETALLE_JORNALES}!$I$7:$I$7)`);
    expect(r.getCell("A6").value).toBe("Zoe");
    expect(r.getCell("A7").value).toBe("TOTAL");
    expect(res(r.getCell("D7"))).toBe(5000);
  });

  it("dos trabajadores con el mismo nombre suman por separado", async () => {
    const r = (
      await abrir({
        ...datos,
        filas: [
          fila({ trabajador_id: "a", trabajador_nombre: "Luis", subtotal: 100 }),
          fila({ trabajador_id: "b", trabajador_nombre: "Luis", subtotal: 900 }),
        ],
      })
    ).getWorksheet(HOJA_RESUMEN_JORNALES)!;
    expect((r.getCell("D5").value as { formula: string }).formula).not.toBe((r.getCell("D6").value as { formula: string }).formula);
    expect(res(r.getCell("D7"))).toBe(1000);
  });

  it("detalle por labor con subtotal por fórmula", async () => {
    const d = (await abrir()).getWorksheet(HOJA_DETALLE_JORNALES)!;
    expect(d.getCell("D5").value).toBe("Poda");
    expect(d.getCell("G5").value).toBe("Palmas");
    expect((d.getCell("I5").value as { formula: string }).formula).toBe("ROUND(F5*H5,2)");
    expect(res(d.getCell("I5"))).toBe(1000);
  });

  it("marca la liquidación anulada", async () => {
    const r = (await abrir({ ...datos, is_voided: true, motivo_anulacion: "Tarifa errada" as never })).getWorksheet(HOJA_RESUMEN_JORNALES)!;
    const textos: string[] = [];
    r.eachRow((row) => row.eachCell((c) => textos.push(String(c.value))));
    expect(textos.some((t) => t.includes("ANULADA") && t.includes("Tarifa errada"))).toBe(true);
  });
});
