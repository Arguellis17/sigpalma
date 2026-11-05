import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env: las credenciales deben venir del entorno (ver e2e/README.md).
}

const PUERTO = 3100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Todas las pruebas son de solo lectura, pero comparten el mismo servidor.
  workers: 3,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    // PW_CHANNEL=msedge usa el Edge instalado, sin descargar navegadores.
    channel: process.env.PW_CHANNEL || undefined,
    // El service worker puede servir páginas de la caché y ocultar errores reales.
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "escritorio", use: { viewport: { width: 1280, height: 800 } } },
    // La aplicación es mobile-first: el operario la usa en el teléfono.
    // Los permisos los decide el servidor: no dependen de la pantalla, se prueban solo en escritorio.
    { name: "movil", testIgnore: /permisos\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/api/v1/ping`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
