# Pruebas de vistas y permisos

Para el equipo de SIG-Palma. Comprueban que cada rol ve lo suyo, que no entra a lo ajeno y que ninguna pantalla se rompe.

## Qué hay

| Capa | Dónde | Qué comprueba | Necesita |
|---|---|---|---|
| Rutas | `lib/__tests__/permisos-rutas.test.ts` | Matriz rol × ruta; cada opción de menú tiene página y cada página está en el menú | Nada |
| Acciones | `lib/__tests__/permisos-acciones.test.ts` | Un rol sin permiso o sin sesión no llega a escribir en la base de datos | Nada |
| Navegador | `e2e/` (Playwright) | Cada página de cada rol abre sin errores en escritorio y móvil, sin desborde lateral; redirecciones entre roles y sin sesión | Servidor y cuentas de prueba |

Las dos primeras corren con `npm test` y en GitHub en cada push y pull request (`.github/workflows/calidad.yml`).

## Ejecutar las pruebas de navegador

Son de **solo lectura**: abren páginas con la base de datos real, pero no crean ni cambian registros. Por leer datos reales no se ejecutan en GitHub hasta decidir qué cuentas usar allí.

```bash
npx next build
npm run test:e2e                     # Chromium: la primera vez, npx playwright install chromium
PW_CHANNEL=msedge npm run test:e2e   # con el Edge instalado, sin descargar nada
npx playwright show-report           # resultado, con captura y traza de lo que falló
```

Variables (en `.env` o en el entorno, nunca en el repositorio):

```bash
E2E_OPERARIO_EMAIL=...
E2E_AGRONOMO_EMAIL=...
E2E_ADMIN_EMAIL=...
E2E_SUPERADMIN_EMAIL=...
E2E_PASSWORD=...              # o E2E_<ROL>_PASSWORD por rol
```

Si falta o falla la cuenta de un rol, sus pruebas aparecen como **omitidas**, no como aprobadas. Revise ese número en el reporte.

## Al agregar una pantalla

- **Página nueva en el menú** (`components/app/nav-rol.ts`): queda cubierta sin escribir nada.
- **Página nueva fuera del menú**: `permisos-rutas.test.ts` falla a propósito. Agréguela al menú o a `FUERA_DEL_MENU`.
- **Server action nueva con restricción de rol**: agregue un caso a `CASOS` en `permisos-acciones.test.ts`.
