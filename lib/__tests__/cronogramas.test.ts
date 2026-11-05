import { describe, expect, it } from "vitest";
import { describirRegla, proximasFechas, type ReglaCronograma } from "@/lib/cronogramas";
import { actualizarCronogramaSchema, crearCronogramaSchema } from "@/lib/validations/cronograma";

const regla = (r: Partial<ReglaCronograma>): ReglaCronograma => ({
  frecuencia: "diaria",
  intervalo: 1,
  dias_semana: [],
  fecha_inicio: "2026-11-02", // lunes
  ...r,
});

describe("proximasFechas", () => {
  it("diaria cada N días, contando desde el inicio", () => {
    expect(proximasFechas(regla({ intervalo: 3 }), "2026-11-02", 3)).toEqual(["2026-11-02", "2026-11-05", "2026-11-08"]);
    // Pedir desde otro día no corre la serie: sigue alineada con el inicio.
    expect(proximasFechas(regla({ intervalo: 3 }), "2026-11-03", 1)).toEqual(["2026-11-05"]);
  });

  it("semanal en los días elegidos", () => {
    expect(proximasFechas(regla({ frecuencia: "semanal", dias_semana: [1, 4] }), "2026-11-02", 4)).toEqual([
      "2026-11-02",
      "2026-11-05",
      "2026-11-09",
      "2026-11-12",
    ]);
  });

  it("semanal cada 2 semanas salta la semana intermedia", () => {
    expect(proximasFechas(regla({ frecuencia: "semanal", intervalo: 2, dias_semana: [1] }), "2026-11-02", 3)).toEqual([
      "2026-11-02",
      "2026-11-16",
      "2026-11-30",
    ]);
  });

  it("semanal: las semanas se cuentan desde el lunes de la semana de inicio, aunque inicie otro día", () => {
    const miercoles = regla({ frecuencia: "semanal", intervalo: 2, dias_semana: [1, 5], fecha_inicio: "2026-11-04" });
    expect(proximasFechas(miercoles, "2026-11-04", 3)).toEqual(["2026-11-06", "2026-11-16", "2026-11-20"]);
  });

  it("domingo es el día 7 (ISO)", () => {
    expect(proximasFechas(regla({ frecuencia: "semanal", dias_semana: [7] }), "2026-11-02", 1)).toEqual(["2026-11-08"]);
  });

  it("mensual usa el último día en meses más cortos y vuelve al día original", () => {
    expect(proximasFechas(regla({ frecuencia: "mensual", fecha_inicio: "2027-01-31" }), "2027-01-01", 4)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });

  it("mensual en año bisiesto y cruzando de año cada 3 meses", () => {
    expect(proximasFechas(regla({ frecuencia: "mensual", fecha_inicio: "2027-12-31", intervalo: 2 }), "2027-12-01", 2)).toEqual([
      "2027-12-31",
      "2028-02-29",
    ]);
    expect(proximasFechas(regla({ frecuencia: "mensual", fecha_inicio: "2026-11-15", intervalo: 3 }), "2026-11-01", 2)).toEqual([
      "2026-11-15",
      "2027-02-15",
    ]);
  });

  it("respeta la fecha final y el inicio futuro", () => {
    expect(proximasFechas(regla({ fecha_fin: "2026-11-03" }), "2026-11-02", 5)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(proximasFechas(regla({ fecha_inicio: "2026-12-01" }), "2026-11-02", 1)).toEqual(["2026-12-01"]);
    expect(proximasFechas(regla({ fecha_fin: "2026-11-01" }), "2026-11-02", 5)).toEqual([]);
  });

  it("semanal sin días no genera ni se queda en un ciclo infinito", () => {
    expect(proximasFechas(regla({ frecuencia: "semanal", dias_semana: [] }), "2026-11-02", 5)).toEqual([]);
  });
});

describe("describirRegla", () => {
  it("texto legible", () => {
    expect(describirRegla(regla({}))).toBe("Todos los días");
    expect(describirRegla(regla({ intervalo: 3 }))).toBe("Cada 3 días");
    expect(describirRegla(regla({ frecuencia: "semanal", dias_semana: [4, 1] }))).toBe("Cada semana: lunes, jueves");
    expect(describirRegla(regla({ frecuencia: "mensual", intervalo: 2, fecha_inicio: "2026-11-05" }))).toBe("Cada 2 meses, el día 5");
  });
});

describe("validación de cronogramas", () => {
  const U = "3f2b8c1e-5a4d-4e6f-9b1a-7c8d9e0f1a2b";
  const base = { finca_id: U, lote_id: U, catalogo_item_id: U, assigned_to: U, frecuencia: "semanal", intervalo: 1, dias_semana: [1], fecha_inicio: "2026-11-05" };

  it("acepta una regla válida", () => {
    expect(crearCronogramaSchema.safeParse(base).success).toBe(true);
    expect(actualizarCronogramaSchema.safeParse({ ...base, id: U }).success).toBe(true);
  });

  it("semanal exige días, pero diaria no", () => {
    expect(crearCronogramaSchema.safeParse({ ...base, dias_semana: [] }).success).toBe(false);
    expect(crearCronogramaSchema.safeParse({ ...base, frecuencia: "diaria", dias_semana: [] }).success).toBe(true);
  });

  it("rechaza fin antes del inicio, intervalo fuera de rango y día inválido", () => {
    expect(crearCronogramaSchema.safeParse({ ...base, fecha_fin: "2026-11-01" }).success).toBe(false);
    expect(crearCronogramaSchema.safeParse({ ...base, intervalo: 0 }).success).toBe(false);
    expect(crearCronogramaSchema.safeParse({ ...base, intervalo: 53 }).success).toBe(false);
    expect(crearCronogramaSchema.safeParse({ ...base, dias_semana: [8] }).success).toBe(false);
  });

  it("actualizar también valida la regla", () => {
    expect(actualizarCronogramaSchema.safeParse({ ...base, id: U, dias_semana: [] }).success).toBe(false);
  });
});
