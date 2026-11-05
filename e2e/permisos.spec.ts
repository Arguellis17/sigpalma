import fs from "node:fs";
import { expect, request, test } from "@playwright/test";
import { DASHBOARD_POR_ROL, estadoSesion, motivoOmitir, ROLES, rutasDe } from "./roles";

const TODAS = ROLES.flatMap((rol) => rutasDe(rol).map((ruta) => ({ rol, ruta })));
const UUID = "3f2b8c1e-5a4d-4e6f-9b1a-7c8d9e0f1a2b";

test.describe("sin sesión", () => {
  for (const { ruta } of TODAS) {
    test(`${ruta} lleva al inicio de sesión`, async ({ baseURL }) => {
      const ctx = await request.newContext({ baseURL });
      const r = await ctx.get(ruta, { maxRedirects: 0 });
      expect(r.status()).toBeGreaterThanOrEqual(300);
      expect(r.status()).toBeLessThan(400);
      expect(r.headers().location).toContain("/auth/login");
      await ctx.dispose();
    });
  }

  test("la sincronización responde 401 en JSON, no una redirección", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const r = await ctx.post("/api/v1/sync", { multipart: { op: "{}" }, maxRedirects: 0 });
    expect(r.status()).toBe(401);
    expect((await r.json()).estado).toBe("sesion");
    await ctx.dispose();
  });

  test("el ping de conectividad es público", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    expect((await ctx.get("/api/v1/ping", { maxRedirects: 0 })).status()).toBe(204);
    await ctx.dispose();
  });

  for (const ruta of [`/api/v1/jornales/${UUID}/xlsx`, `/api/v1/remisiones/${UUID}/pdf`]) {
    test(`${ruta.split("/")[3]}: no entrega archivos`, async ({ baseURL }) => {
      const ctx = await request.newContext({ baseURL });
      expect((await ctx.get(ruta, { maxRedirects: 0 })).status()).not.toBe(200);
      await ctx.dispose();
    });
  }
});

for (const rol of ROLES) {
  test.describe(`${rol}: rutas de otros roles`, () => {
    for (const { rol: dueno, ruta } of TODAS.filter((t) => t.rol !== rol)) {
      test(`${ruta} (${dueno}) lo devuelve a su panel`, async ({ baseURL }) => {
        test.skip(!fs.existsSync(estadoSesion(rol)), motivoOmitir(rol));
        const ctx = await request.newContext({ baseURL, storageState: estadoSesion(rol) });
        const r = await ctx.get(ruta, { maxRedirects: 0 });
        expect(r.status()).toBeGreaterThanOrEqual(300);
        expect(r.status()).toBeLessThan(400);
        expect(new URL(r.headers().location, baseURL).pathname).toBe(DASHBOARD_POR_ROL[rol]);
        await ctx.dispose();
      });
    }
  });
}

test("un operario no descarga la liquidación de jornales", async ({ baseURL }) => {
  test.skip(!fs.existsSync(estadoSesion("operario")), motivoOmitir("operario"));
  const ctx = await request.newContext({ baseURL, storageState: estadoSesion("operario") });
  expect((await ctx.get(`/api/v1/jornales/${UUID}/xlsx`, { maxRedirects: 0 })).status()).toBe(403);
  await ctx.dispose();
});
