import { describe, expect, it } from "vitest";
import {
  estadoPermiteAsignacion,
  estadoRequiereNotasDano,
  labelEstadoHerramienta,
} from "@/lib/herramientas-estado";
import { isEstadoPlanificable, labelEstadoCultivo } from "@/lib/lote-estado";
import {
  PENDIENTE_TERRENO_MAX_PCT,
  labelActividadPreparacion,
  mensajePendienteCritica,
  pendienteRequiereValidacionTecnico,
} from "@/lib/preparacion-terreno";
import {
  excedeDesviacionDosisAutorizada,
  mensajeDesviacionDosis,
  parseCantidadDosis,
} from "@/lib/sanidad-dosis";
import {
  normalizeNumericInputOnBlur,
  parseDecimalInput,
  sanitizeNumericInput,
} from "@/lib/numeric-input";

describe("herramientas: estados (HU18)", () => {
  it("solo una herramienta disponible se puede asignar", () => {
    expect(estadoPermiteAsignacion("disponible")).toBe(true);
    for (const e of ["en_uso", "danada", "perdida"]) expect(estadoPermiteAsignacion(e)).toBe(false);
  });
  it("dañada o perdida exigen descripción (RN)", () => {
    expect(estadoRequiereNotasDano("danada")).toBe(true);
    expect(estadoRequiereNotasDano("perdida")).toBe(true);
    expect(estadoRequiereNotasDano("disponible")).toBe(false);
  });
  it("muestra etiquetas legibles", () => {
    expect(labelEstadoHerramienta("en_uso")).toBe("En uso");
    expect(labelEstadoHerramienta(null)).toBe("—");
    expect(labelEstadoHerramienta("otro")).toBe("otro");
  });
});

describe("lotes: estados del cultivo (HU10)", () => {
  it("solo se planifica siembra en lotes vacantes o disponibles", () => {
    expect(isEstadoPlanificable("vacante")).toBe(true);
    expect(isEstadoPlanificable("disponible")).toBe(true);
    expect(isEstadoPlanificable("en_produccion")).toBe(false);
    expect(isEstadoPlanificable("planificado_siembra")).toBe(false);
  });
  it("muestra etiquetas legibles", () => {
    expect(labelEstadoCultivo("listo_para_siembra")).toBe("Listo para siembra");
    expect(labelEstadoCultivo("x")).toBe("x");
  });
});

describe("preparación de terreno: pendiente (HU19, CP-039)", () => {
  it("el umbral es 12 %", () => {
    expect(PENDIENTE_TERRENO_MAX_PCT).toBe(12);
  });
  it("12 % o más exige validación del técnico (a diferencia de la alerta de lotes, que salta por encima de 12 %)", () => {
    expect(pendienteRequiereValidacionTecnico(11.99)).toBe(false);
    expect(pendienteRequiereValidacionTecnico(12)).toBe(true);
    expect(pendienteRequiereValidacionTecnico(14)).toBe(true);
  });
  it("el mensaje menciona la validación del técnico", () => {
    expect(mensajePendienteCritica(14)).toMatch(/validación del técnico/);
  });
  it("traduce las actividades", () => {
    expect(labelActividadPreparacion("surcos")).toBe("Apertura de surcos");
    expect(labelActividadPreparacion("otra")).toBe("otra");
  });
});

describe("sanidad: dosis autorizada (HU23)", () => {
  it("extrae el número de textos con coma o punto", () => {
    expect(parseCantidadDosis("2,5 kg/ha")).toBe(2.5);
    expect(parseCantidadDosis("10 L")).toBe(10);
    expect(parseCantidadDosis("sin número")).toBeNull();
    expect(parseCantidadDosis("0 kg")).toBeNull();
  });
  it("excede cuando supera la dosis en más del 20 %", () => {
    expect(excedeDesviacionDosisAutorizada(12, "10 L")).toBe(false);
    expect(excedeDesviacionDosisAutorizada(12.1, "10 L")).toBe(true);
  });
  it("no valida si la dosis recomendada no tiene número", () => {
    expect(excedeDesviacionDosisAutorizada(100, "según etiqueta")).toBe(false);
    expect(mensajeDesviacionDosis(100, "según etiqueta")).toBeNull();
  });
  it("el mensaje indica el máximo permitido", () => {
    expect(mensajeDesviacionDosis(15, "10 L")).toMatch(/máximo 12\.00/);
    expect(mensajeDesviacionDosis(11, "10 L")).toBeNull();
  });
});

describe("campos numéricos de los formularios", () => {
  it("interpreta coma y punto decimal", () => {
    expect(parseDecimalInput("2,5")).toBe(2.5);
    expect(parseDecimalInput(" 3.75 ")).toBe(3.75);
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("-")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
  });
  it("solo deja escribir números parciales válidos", () => {
    expect(sanitizeNumericInput("12,5")).toBe("12,5");
    expect(sanitizeNumericInput("12a")).toBeNull();
    expect(sanitizeNumericInput("")).toBe("");
    expect(sanitizeNumericInput("1.5", { integer: true })).toBeNull();
    expect(sanitizeNumericInput("15", { integer: true })).toBe("15");
  });
  it("quita el separador sobrante al salir del campo", () => {
    expect(normalizeNumericInputOnBlur("12.")).toBe("12");
    expect(normalizeNumericInputOnBlur(" 7,5 ")).toBe("7,5");
  });
});
