import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { DASHBOARD_POR_ROL, estadoSesion, motivoOmitir, ROLES, rutasDe } from "./roles";

/** Solo lectura: abre cada página de cada rol; no envía formularios ni pulsa botones de acción. */
for (const rol of ROLES) {
  test.describe(`vistas de ${rol}`, () => {
    const conSesion = fs.existsSync(estadoSesion(rol));
    test.skip(!conSesion, motivoOmitir(rol));
    if (conSesion) test.use({ storageState: estadoSesion(rol) });

    for (const ruta of rutasDe(rol)) {
      test(`${ruta} abre sin errores`, async ({ page }) => {
        const errores: string[] = [];
        page.on("pageerror", (e) => errores.push(`excepción: ${e.message}`));
        page.on("console", (m) => {
          if (m.type() === "error") errores.push(`consola: ${m.text()}`);
        });

        const respuesta = await page.goto(ruta, { waitUntil: "load" });
        expect(respuesta?.status(), "código HTTP").toBeLessThan(400);
        expect(new URL(page.url()).pathname, "no debe redirigir").toBe(ruta);

        await expect(page.locator("main h1, main h2, h1, h2").first(), "la página tiene título").toBeVisible();
        await expect(page.getByText(/application error|something went wrong/i)).toHaveCount(0);

        // Da tiempo a que terminen las lecturas iniciales del cliente.
        await page.waitForTimeout(500);

        const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(desborde, "sin desplazamiento horizontal de la página").toBeLessThanOrEqual(1);

        expect(errores).toEqual([]);
      });
    }

    test("el menú lateral muestra todas sus opciones", async ({ page }, info) => {
      test.skip(info.project.name !== "escritorio", "En móvil el menú está plegado.");
      await page.goto(DASHBOARD_POR_ROL[rol]);
      for (const ruta of rutasDe(rol)) {
        await expect(page.locator(`a[href="${ruta}"]`).first(), ruta).toBeVisible();
      }
    });

    test("el menú navega a otra página", async ({ page }, info) => {
      test.skip(info.project.name !== "escritorio", "En móvil el menú está plegado.");
      const destino = rutasDe(rol)[1];
      await page.goto(DASHBOARD_POR_ROL[rol]);
      await page.locator(`a[href="${destino}"]`).first().click();
      await page.waitForURL(`**${destino}`);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    test("no aparecen opciones de otros roles", async ({ page }, info) => {
      test.skip(info.project.name !== "escritorio", "En móvil el menú está plegado.");
      await page.goto(DASHBOARD_POR_ROL[rol]);
      for (const otro of ROLES.filter((r) => r !== rol)) {
        await expect(page.locator(`a[href^="${DASHBOARD_POR_ROL[otro]}/"]`)).toHaveCount(0);
      }
    });
  });
}

test.describe("inicio de sesión", () => {
  test("credenciales incorrectas no entran", async ({ page }) => {
    await page.goto("/auth/login");
    await page.locator("#identifier").fill("no-existe@example.com");
    await page.locator("#password").fill("clave-incorrecta");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    expect(new URL(page.url()).pathname).toContain("/auth");
  });
});
