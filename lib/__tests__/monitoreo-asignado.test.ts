import { describe, expect, it } from "vitest";
import {
  RUTA_MONITOREOS_OPERARIO,
  construirAvisoMonitoreo,
  debeNotificarAsignacion,
} from "@/lib/notificaciones/monitoreo-asignado";
import {
  actualizarMonitoreoProgramadoSchema,
  crearMonitoreoProgramadoSchema,
} from "@/lib/validations/monitoreo-programado";

const RONALD = "f6701d42-446f-48af-9b5a-8b4dff53bb2f";
const OTRO = "64c5908e-55ae-4d83-b139-8bf4128e45ea";
const FINCA = "d4e96ae4-05af-40da-8868-2fb8509dc4ae";
const LOTE = "5de0fe48-860d-486d-9faa-c209adafb80a";

const evento = {
  monitoreoId: "m1",
  loteCodigo: "L-04",
  fechaInspeccion: "2026-10-08",
  notas: "Revisar flechas nuevas en el sector norte",
  reasignado: false,
};

describe("debeNotificarAsignacion", () => {
  it("al crear (sin operario anterior) siempre avisa", () => {
    expect(debeNotificarAsignacion(null, RONALD)).toBe(true);
  });

  it("al reasignar a otro operario avisa al nuevo", () => {
    expect(debeNotificarAsignacion(OTRO, RONALD)).toBe(true);
  });

  it("editar fecha o notas con el mismo operario no es una nueva asignación", () => {
    expect(debeNotificarAsignacion(RONALD, RONALD)).toBe(false);
  });
});

describe("construirAvisoMonitoreo", () => {
  it("nueva asignación: lote en el título, fecha legible y notas", () => {
    expect(construirAvisoMonitoreo(evento)).toEqual({
      titulo: "Nuevo monitoreo asignado · Lote L-04",
      cuerpo: "Inspección fitosanitaria programada para el 08/10/2026. Revisar flechas nuevas en el sector norte",
    });
  });

  it("reasignación y sin notas", () => {
    expect(construirAvisoMonitoreo({ ...evento, reasignado: true, notas: null })).toEqual({
      titulo: "Monitoreo reasignado a usted · Lote L-04",
      cuerpo: "Inspección fitosanitaria programada para el 08/10/2026",
    });
  });

  it("recorta notas largas", () => {
    const { cuerpo } = construirAvisoMonitoreo({ ...evento, notas: "n".repeat(300) });
    expect(cuerpo.endsWith("…")).toBe(true);
    expect(cuerpo.length).toBeLessThan(170);
  });

  it("enlaza a los monitoreos del operario", () => {
    expect(RUTA_MONITOREOS_OPERARIO).toBe("/operario/sanidad/monitoreos-pendientes");
  });
});

// Regresión: la asignación de monitoreos sigue validando igual tras agregar la notificación.
describe("regresión: validación de asignación de monitoreos", () => {
  const base = { finca_id: FINCA, lote_id: LOTE, fecha_inspeccion: "2026-10-08", assigned_to: RONALD, notas: "x" };

  it("acepta una programación válida y exige operario asignado", () => {
    expect(crearMonitoreoProgramadoSchema.safeParse(base).success).toBe(true);
    expect(crearMonitoreoProgramadoSchema.safeParse({ ...base, assigned_to: undefined }).success).toBe(false);
    expect(crearMonitoreoProgramadoSchema.safeParse({ ...base, assigned_to: "no-uuid" }).success).toBe(false);
  });

  it("rechaza fechas con formato inválido", () => {
    expect(crearMonitoreoProgramadoSchema.safeParse({ ...base, fecha_inspeccion: "08/10/2026" }).success).toBe(false);
  });

  it("la reasignación (actualizar) exige id y operario", () => {
    expect(
      actualizarMonitoreoProgramadoSchema.safeParse({ ...base, id: "2bd6e51c-6532-4ee4-9041-57178e23a445", assigned_to: OTRO }).success
    ).toBe(true);
    expect(actualizarMonitoreoProgramadoSchema.safeParse(base).success).toBe(false);
  });
});
