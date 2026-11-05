import { createSerwistRoute } from "@serwist/turbopack";

/**
 * Sirve el service worker compilado desde `app/sw.ts` en `/serwist/sw.js` (estático, generado en
 * `next build`). Incluye la página `/~offline` en la precaché como respaldo sin conexión.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "app/sw.ts",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }],
  useNativeEsbuild: true,
});
