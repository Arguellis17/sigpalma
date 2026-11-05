import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildNavGroups } from "@/components/app/nav-rol";
import {
  DASHBOARD_POR_ROL,
  isPlatformRoute,
  isPublicAuthPath,
  ROLES,
  segmentRoleRedirect,
} from "@/lib/auth/rutas-rol";

const PLATAFORMA = path.join(process.cwd(), "app", "(plataforma)");

/** Rutas de páginas fijas de un segmento: /admin, /admin/usuarios… */
function paginas(segmento: string): string[] {
  const encontradas: string[] = [];
  const recorrer = (dir: string, ruta: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name === "page.tsx") encontradas.push(ruta);
      if (e.isDirectory() && !e.name.startsWith("[")) recorrer(path.join(dir, e.name), `${ruta}/${e.name}`);
    }
  };
  recorrer(path.join(PLATAFORMA, segmento), `/${segmento}`);
  return encontradas;
}

const rutasMenu = (rol: (typeof ROLES)[number]) =>
  buildNavGroups(rol).flatMap((g) => g.items.map((i) => i.href));

describe("matriz de acceso por rol", () => {
  const SEGMENTOS: Record<(typeof ROLES)[number], string> = {
    superadmin: "/superadmin/usuarios",
    admin: "/admin/usuarios",
    agronomo: "/tecnico/agenda",
    operario: "/operario/cosecha",
  };

  for (const rol of ROLES) {
    for (const dueno of ROLES) {
      const ruta = SEGMENTOS[dueno];
      if (rol === dueno) {
        it(`${rol} entra a ${ruta}`, () => {
          expect(segmentRoleRedirect(ruta, rol)).toBeNull();
        });
      } else {
        it(`${rol} no entra a ${ruta}: vuelve a su panel`, () => {
          expect(segmentRoleRedirect(ruta, rol)).toBe(DASHBOARD_POR_ROL[rol]);
        });
      }
    }
  }

  it("un rol desconocido nunca entra a una ruta de otro rol", () => {
    for (const ruta of Object.values(SEGMENTOS)) {
      expect(segmentRoleRedirect(ruta, "intruso")).not.toBeNull();
    }
  });

  it("rutas públicas y de plataforma no se confunden", () => {
    expect(isPublicAuthPath("/auth/login")).toBe(true);
    expect(isPublicAuthPath("/admin")).toBe(false);
    expect(isPlatformRoute("/admin/usuarios")).toBe(true);
    expect(isPlatformRoute("/auth/login")).toBe(false);
    expect(isPlatformRoute("/api/v1/sync")).toBe(false);
  });
});

describe("menú de cada rol", () => {
  for (const rol of ROLES) {
    const menu = rutasMenu(rol);

    it(`${rol}: tiene opciones y empieza por su panel`, () => {
      expect(menu.length).toBeGreaterThan(0);
      expect(menu[0]).toBe(DASHBOARD_POR_ROL[rol]);
    });

    it(`${rol}: no hay opciones repetidas`, () => {
      expect(new Set(menu).size).toBe(menu.length);
    });

    it(`${rol}: todas las opciones son rutas que su rol puede abrir`, () => {
      for (const ruta of menu) expect(segmentRoleRedirect(ruta, rol), ruta).toBeNull();
    });

    it(`${rol}: toda opción del menú tiene su página`, () => {
      for (const ruta of menu) {
        expect(fs.existsSync(path.join(PLATAFORMA, ...ruta.split("/"), "page.tsx")), ruta).toBe(true);
      }
    });
  }

  it("sin rol no hay menú", () => {
    expect(buildNavGroups(null)).toEqual([]);
  });

  // Una página nueva que nadie agrega al menú queda inaccesible: esta prueba lo avisa.
  // /tecnico/suelo/nuevo solo redirige a /tecnico/suelo.
  const FUERA_DEL_MENU = new Set(["/tecnico/suelo/nuevo"]);

  for (const [rol, segmento] of [
    ["superadmin", "superadmin"],
    ["admin", "admin"],
    ["agronomo", "tecnico"],
    ["operario", "operario"],
  ] as const) {
    it(`${rol}: toda página de /${segmento} está en el menú`, () => {
      const menu = new Set(rutasMenu(rol));
      const huerfanas = paginas(segmento).filter((p) => !menu.has(p) && !FUERA_DEL_MENU.has(p));
      expect(huerfanas).toEqual([]);
    });
  }
});
