import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { credenciales, estadoSesion, ROLES } from "./roles";

/** Inicia sesión una vez por rol y guarda las cookies; las pruebas reutilizan esa sesión. */
export default async function globalSetup(config: FullConfig) {
  const { baseURL, channel } = config.projects[0].use;
  fs.mkdirSync(path.join(__dirname, ".auth"), { recursive: true });

  const navegador = await chromium.launch({ channel });
  try {
    for (const rol of ROLES) {
      const archivo = estadoSesion(rol);
      fs.rmSync(archivo, { force: true });
      const cred = credenciales(rol);
      if (!cred) continue;

      const contexto = await navegador.newContext({ baseURL, serviceWorkers: "block" });
      const pagina = await contexto.newPage();
      await pagina.goto("/auth/login");
      await pagina.locator("#identifier").fill(cred.email);
      await pagina.locator("#password").fill(cred.password);
      await pagina.locator('button[type="submit"]').click();
      try {
        await pagina.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30_000 });
        await contexto.storageState({ path: archivo });
      } catch {
        // Sin archivo de sesión las pruebas de este rol se omiten y lo indican.
        console.warn(`[e2e] No se pudo iniciar sesión como ${rol}: se omiten sus pruebas.`);
      }
      await contexto.close();
    }
  } finally {
    await navegador.close();
  }
}
