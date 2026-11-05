import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Matriz de permisos de las server actions: un rol sin permiso no debe llegar a escribir nada.
 * Es la barrera real: una action es un endpoint público, ocultar el botón no la protege.
 */
const FINCA = "3f2b8c1e-5a4d-4e6f-9b1a-7c8d9e0f1a2b";
const OTRO = "4f2b8c1e-5a4d-4e6f-9b1a-7c8d9e0f1a2c";

type Rol = "superadmin" | "admin" | "agronomo" | "operario";
const ROLES: Rol[] = ["superadmin", "admin", "agronomo", "operario"];

const estado = vi.hoisted(() => ({
  sesion: null as unknown,
  escrituras: [] as string[],
  lecturas: 0,
}));

vi.mock("@/lib/auth/session-profile", async (original) => ({
  ...(await original<typeof import("@/lib/auth/session-profile")>()),
  getSessionProfile: async () => estado.sesion,
}));

/**
 * Cliente falso: cualquier consulta devuelve "sin datos" y registra lo que intenta escribir.
 * El cliente no es "thenable" (se usa con `await createClient()`); la cadena de consulta sí.
 */
const ESCRITURAS = ["insert", "update", "delete", "upsert", "rpc", "upload"];

function cadenaFalsa(): unknown {
  const cadena: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown) => ok({ data: null, error: null, count: 0 });
      }
      return () => {
        if (ESCRITURAS.includes(String(prop))) estado.escrituras.push(String(prop));
        return cadena;
      };
    },
  });
  return cadena;
}

function clienteFalso() {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        if (prop === "auth" || prop === "storage") {
          estado.lecturas += 1;
          return cadenaFalsa();
        }
        return () => {
          estado.lecturas += 1;
          if (ESCRITURAS.includes(String(prop))) estado.escrituras.push(String(prop));
          return cadenaFalsa();
        };
      },
    }
  );
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFalso() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => clienteFalso() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));

function sesionDe(rol: Rol) {
  return {
    user: { id: OTRO, email: "prueba@example.com" },
    profile: { id: OTRO, role: rol, finca_id: rol === "superadmin" ? null : FINCA, is_active: true, full_name: "Prueba" },
  };
}

const regla = { finca_id: FINCA, lote_id: FINCA, catalogo_item_id: FINCA, assigned_to: OTRO, frecuencia: "diaria", intervalo: 1, dias_semana: [], fecha_inicio: "2099-01-01" };
const periodo = { desde: "2026-11-01", hasta: "2026-11-30" };
const GPS = { latitud: 7, longitud: -72 };

type Caso = {
  nombre: string;
  permitidos: Rol[];
  llamar: () => Promise<{ success: boolean }>;
};

const CASOS: Caso[] = [
  {
    nombre: "crearCronograma",
    permitidos: ["agronomo"],
    llamar: async () => (await import("@/app/actions/cronogramas")).crearCronograma(regla),
  },
  {
    nombre: "actualizarCronograma",
    permitidos: ["agronomo"],
    llamar: async () => (await import("@/app/actions/cronogramas")).actualizarCronograma({ ...regla, id: FINCA }),
  },
  {
    nombre: "anularCronograma",
    permitidos: ["agronomo"],
    llamar: async () => (await import("@/app/actions/cronogramas")).anularCronograma({ id: FINCA }),
  },
  {
    nombre: "guardarTarifa",
    permitidos: ["admin"],
    llamar: async () => (await import("@/app/actions/jornales")).guardarTarifa({ catalogo_item_id: FINCA, unidad_medida: "palmas", valor_unitario: 100, vigente_desde: "2026-01-01" }),
  },
  {
    nombre: "calcularLiquidacion",
    permitidos: ["admin"],
    llamar: async () => (await import("@/app/actions/jornales")).calcularLiquidacion(periodo),
  },
  {
    nombre: "cerrarLiquidacion",
    permitidos: ["admin"],
    llamar: async () => (await import("@/app/actions/jornales")).cerrarLiquidacion(periodo),
  },
  {
    nombre: "anularLiquidacion",
    permitidos: ["admin"],
    llamar: async () => (await import("@/app/actions/jornales")).anularLiquidacion({ id: FINCA, motivo: "Motivo suficiente" }),
  },
  {
    nombre: "registrarLabor (programar)",
    permitidos: ["agronomo"],
    llamar: async () => (await import("@/app/actions/labores")).registrarLabor({ finca_id: FINCA, lote_id: FINCA, tipo: "Poda", fecha_ejecucion: "2099-01-01", catalogo_item_id: FINCA, assigned_to: OTRO }),
  },
  {
    nombre: "registrarLaborEjecutada",
    permitidos: ["operario"],
    llamar: async () => (await import("@/app/actions/labores")).registrarLaborEjecutada({ finca_id: FINCA, lote_id: FINCA, catalogo_item_id: FINCA, cantidad_ejecutada: 1, unidad_medida: "palmas", fecha_ejecucion: "2026-11-05" }),
  },
  {
    nombre: "marcarMonitoreoCompletado",
    permitidos: ["operario"],
    llamar: async () => (await import("@/app/actions/monitoreo-programado")).marcarMonitoreoCompletado({ id: FINCA }),
  },
  {
    nombre: "crearEvaluacionVivero",
    permitidos: ["agronomo", "superadmin"],
    llamar: async () => (await import("@/app/actions/evaluacion-vivero")).crearEvaluacionVivero({ finca_id: FINCA, germinacion_id: FINCA, total_inicial: 10, unidades_germinadas: 5, unidades_descartadas: 0, concepto: "apto_trasplante" }),
  },
  {
    nombre: "tomarHerramienta",
    permitidos: ["operario", "admin", "superadmin"],
    llamar: async () => (await import("@/app/actions/herramientas")).tomarHerramienta({ id: FINCA }),
  },
  {
    nombre: "anularCosecha",
    permitidos: ["operario", "agronomo", "superadmin"],
    llamar: async () => (await import("@/app/actions/cosecha")).anularCosecha({ id: FINCA }),
  },
  {
    nombre: "crearAlertaFitosanitaria",
    permitidos: ["operario", "agronomo", "superadmin"],
    llamar: async () => (await import("@/app/actions/alertas")).crearAlertaFitosanitaria({ finca_id: FINCA, lote_id: FINCA, severidad: "baja", evidencia_urls: ["fincas/a/b.png"], ...GPS }),
  },
  {
    nombre: "crearUsuarioConRol",
    permitidos: ["admin", "superadmin"],
    llamar: async () => (await import("@/app/actions/usuarios")).crearUsuarioConRol({ email: "nuevo@example.com", password: "12345678", full_name: "Nuevo", role: "operario", finca_id: FINCA }),
  },
  {
    nombre: "crearFinca",
    permitidos: ["superadmin"],
    llamar: async () => (await import("@/app/actions/fincas")).crearFinca({ nombre: "Finca", area_ha: 10 }),
  },
];

beforeEach(() => {
  estado.escrituras = [];
  estado.lecturas = 0;
  estado.sesion = null;
});

describe.each(CASOS)("$nombre", ({ permitidos, llamar }) => {
  it("sin sesión: se rechaza sin tocar la base de datos para escribir", async () => {
    const r = await llamar();
    expect(r.success).toBe(false);
    expect(estado.escrituras).toEqual([]);
  });

  for (const rol of ROLES.filter((x) => !permitidos.includes(x))) {
    it(`${rol}: sin permiso, no escribe nada`, async () => {
      estado.sesion = sesionDe(rol);
      const r = await llamar();
      expect(r.success).toBe(false);
      expect(estado.escrituras).toEqual([]);
    });
  }

  // Evita que la matriz pase por el motivo equivocado: el rol permitido sí cruza la barrera.
  for (const rol of permitidos) {
    it(`${rol}: permitido, llega a consultar la base de datos`, async () => {
      estado.sesion = sesionDe(rol);
      // Pasada la barrera, la action puede fallar con los datos vacíos del cliente falso: no importa aquí.
      await llamar().catch(() => undefined);
      expect(estado.lecturas).toBeGreaterThan(0);
    });
  }
});

describe("sesión inactiva", () => {
  it("un usuario desactivado no puede registrar labores ni liquidar", async () => {
    const s = sesionDe("operario");
    estado.sesion = { ...s, profile: { ...s.profile, is_active: false } };
    const labor = await (await import("@/app/actions/labores")).registrarLaborEjecutada({ finca_id: FINCA, lote_id: FINCA, catalogo_item_id: FINCA, cantidad_ejecutada: 1, unidad_medida: "palmas", fecha_ejecucion: "2026-11-05" });
    expect(labor.success).toBe(false);
    const a = sesionDe("admin");
    estado.sesion = { ...a, profile: { ...a.profile, is_active: false } };
    const liq = await (await import("@/app/actions/jornales")).cerrarLiquidacion(periodo);
    expect(liq.success).toBe(false);
    expect(estado.escrituras).toEqual([]);
  });
});

describe("otra finca", () => {
  it("un agrónomo no crea cronogramas en otra finca", async () => {
    estado.sesion = sesionDe("agronomo");
    const r = await (await import("@/app/actions/cronogramas")).crearCronograma({ ...regla, finca_id: OTRO });
    expect(r.success).toBe(false);
    expect(estado.escrituras).toEqual([]);
  });

  it("un operario no registra labores en otra finca", async () => {
    estado.sesion = sesionDe("operario");
    const r = await (await import("@/app/actions/labores")).registrarLaborEjecutada({ finca_id: OTRO, lote_id: FINCA, catalogo_item_id: FINCA, cantidad_ejecutada: 1, unidad_medida: "palmas", fecha_ejecucion: "2026-11-05" });
    expect(r.success).toBe(false);
    expect(estado.escrituras).toEqual([]);
  });
});
