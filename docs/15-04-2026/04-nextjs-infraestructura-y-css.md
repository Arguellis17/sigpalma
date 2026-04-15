# Infraestructura Next.js, bundler y CSS global

## Objetivo

Estabilizar el entorno de desarrollo (**`next dev`**) frente a problemas de resolución de imports CSS con **Turbopack** cuando el workspace tiene **varios lockfiles** o la raíz inferida no coincide con la carpeta del proyecto. Documentar el arreglo en **`globals.css`** y **`next.config.ts`**, y el uso de **Webpack** como bundler por defecto en scripts.

## Antes

- `npm run dev` con Turbopack por defecto podía fallar con errores del tipo **Can't resolve 'tailwindcss'** resolviendo desde un directorio **padre** del workspace (p. ej. `Desktop/ufps`) en lugar de `sigpalma/node_modules`.
- Los imports típicos `@import "tailwindcss"` dependían de la resolución del bundler/postcss respecto a la raíz del proyecto.

## Ahora

### 1. Script `dev` con Webpack

Archivo: [`package.json`](../../package.json)

- `"dev": "next dev --webpack"` — Next.js 16 admite explícitamente `--webpack` como alternativa estable a Turbopack.
- `"dev:webpack"` duplica el mismo comando para compatibilidad con documentación o hábitos del equipo.

**Efecto:** el flujo diario de desarrollo evita la clase de fallos de resolución CSS observados con Turbopack en este layout de carpetas.

### 2. `turbopack.root` para silenciar avisos y anclar la raíz

Archivo: [`next.config.ts`](../../next.config.ts)

- Se calcula `projectRoot` con `createRequire` + `require.resolve("./package.json")` para obtener la carpeta real del paquete **sigpalma**.
- Se asigna `turbopack.root: projectRoot` para alinear la raíz con el proyecto (p. ej. aviso de *multiple lockfiles* en el home del usuario).

**Nota:** aunque el `dev` diario use Webpack, esta opción sigue siendo útil si alguien ejecuta `next dev` sin `--webpack`.

### 3. Imports CSS con rutas relativas a `node_modules`

Archivo: [`app/globals.css`](../../app/globals.css) (inicio del archivo)

En lugar de depender solo del nombre de paquete, se importan con rutas relativas desde `app/`:

```css
@import "../node_modules/tailwindcss/index.css";
@import "../node_modules/tw-animate-css/dist/tw-animate.css";
@import "../node_modules/shadcn/dist/tailwind.css";
```

**Motivo:** fuerza la resolución respecto al árbol del proyecto **sigpalma**, evitando que el resolver suba al directorio equivocado.

### 4. Resto del sistema visual en `globals.css`

- Variables de tema (`:root`, modo oscuro si aplica), utilidades **`app-shell-bg`**, **`surface-panel`**, **`dashboard-glow`**, animaciones (`fade-up-enter`, `float-gentle`, `pulse-soft`) y respeto a **`prefers-reduced-motion`**.
- `@theme inline` alinea tokens con Tailwind v4 y shadcn.

### 5. Tipografías en el layout raíz

Archivo: [`app/layout.tsx`](../../app/layout.tsx)

- Fuentes **Plus Jakarta Sans**, **IBM Plex Mono**, **Lora** vía `next/font/google`, expuestas como variables CSS consumidas en `globals.css` / `@theme`.

## Resumen antes → ahora

| Aspecto | Antes | Ahora |
|---------|--------|--------|
| Bundler en `npm run dev` | Turbopack (default), errores de CSS en este repo | Webpack explícito en script `dev` |
| Imports Tailwind/shadcn | Resolución frágil según raíz inferida | Rutas relativas a `node_modules` en `globals.css` |
| Config Next | Sin anclaje explícito de raíz Turbopack | `turbopack.root` = directorio del `package.json` del proyecto |

## Archivos citados

- [`package.json`](../../package.json)
- [`next.config.ts`](../../next.config.ts)
- [`app/globals.css`](../../app/globals.css)
- [`app/layout.tsx`](../../app/layout.tsx)
