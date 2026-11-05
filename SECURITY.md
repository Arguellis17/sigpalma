# Seguridad de dependencias

Para el equipo de SIG-Palma: cómo se auditan las dependencias, qué se corrigió y qué riesgos quedan aceptados.

## Cómo auditar

```bash
npm run audit:deps       # producción: falla con severidad alta o crítica
npm run audit:deps:todo  # incluye herramientas de desarrollo (informativo)
```

GitHub Actions ejecuta lo mismo en cada push y pull request a `main`, y cada lunes
(`.github/workflows/auditoria-dependencias.yml`). La revisión semanal importa: aparecen vulnerabilidades
nuevas aunque el código no cambie.

### Python (pip-audit)

Este repositorio **no tiene código ni dependencias de Python**: no hay `requirements.txt`, `pyproject.toml` ni archivos `.py`, así que `pip-audit` no tiene nada que analizar. El flujo de GitHub lo ejecuta automáticamente si algún día aparece uno de esos archivos.

## Auditoría del 5 de noviembre de 2026

| | Crítica | Alta | Moderada | Baja |
|---|---|---|---|---|
| Antes (todas las dependencias) | 3 | 9 | 19 | 1 |
| Después, producción (`--omit=dev`) | 0 | 0 | 0 | 0 |

### Corregido

| Paquete | Cambio | Riesgo |
|---|---|---|
| `next` | 16.3.8 → 16.4.5 | **Crítico en producción:** ejecución remota de código sin autenticación (optimización de imágenes SVG y `use cache`) y denegación de servicio por Server Actions |
| `zod` | 4.6.5 → 4.6.7, también en copias anidadas (`overrides`) | Alto: agotamiento de memoria con colecciones muy grandes |
| `vitest` | 3 → 5 | Crítico solo en desarrollo: tinypool y lectura de archivos con el servidor de pruebas |
| `drizzle-kit` | 0.18 → 0.31 | Alto solo en desarrollo |
| `shadcn` | 4.21 → 4.23; pasa a `devDependencies` | Alto solo en desarrollo (arrastraba `undici`, `body-parser` y el SDK de MCP). Se usa solo al compilar (CSS) y al agregar componentes |
| `eslint-config-next` | 16.2.3 → 16.4.5 | Alineado con `next` |
| `uuid` en `exceljs` | 8 → 11 (`overrides`) | Moderado. `exceljs` solo usa `v4`, que no estaba afectado; se actualizó para dejar limpia la auditoría |
| `glob` en `@serwist/build` | 13 → 14 (`overrides`) | Moderado. Solo se usa al compilar el service worker |

### Riesgos aceptados (solo desarrollo)

Quedan avisos de severidad baja y moderada que **no llegan a producción**. `npm audit fix --force` propone *bajar* de versión mayor estos paquetes, lo que los rompería, por eso no se aplica.

| Paquete | Vía | Por qué se acepta |
|---|---|---|
| `esbuild` antiguo | `drizzle-kit` → `@esbuild-kit/*` | Su servidor de desarrollo no se usa; `drizzle-kit` solo corre en el equipo del desarrollador |
| `minimatch` | `eslint-config-next`, `shadcn` | Denegación de servicio con patrones maliciosos; aquí los patrones son los del propio proyecto |
| `deepmerge` | `shadcn` | Solo procesa la configuración del propio CLI |

Revisarlos cuando sus proyectos publiquen una versión corregida.

## Qué hacer ante un aviso nuevo

1. ¿Llega a producción? `npm audit --omit=dev` lo responde.
2. Crítica o alta en producción: actualizar de inmediato, en su propia rama.
3. Dependencia anidada sin versión corregida del paquete padre: `overrides` en `package.json`, comprobando con pruebas que sigue funcionando.
4. Solo desarrollo y sin arreglo: anotarlo en la tabla de arriba con el motivo.
5. No usar `npm audit fix --force` sin revisar: suele bajar versiones mayores.

## Tras actualizar `next`, `serwist` o `exceljs`

Ejecutar `npx tsc --noEmit`, `npm test`, `npx next build` y las pruebas de punta a punta. El modo sin conexión y los Excel dependen directamente de estos paquetes.
