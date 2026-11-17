import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.dirname(require.resolve("./package.json"));
const canvasStub = path.join(projectRoot, "stubs/canvas-empty.js");

// Cabeceras de seguridad. La política de contenido (CSP) va en modo "solo reporte": avisa en la consola del
// navegador de lo que bloquearía, sin romper la aplicación; cuando no haya avisos se pasa a modo estricto.
const politicaContenido = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La cámara y el GPS se usan en los formularios de campo; el resto de permisos se desactiva.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
          { key: "Content-Security-Policy-Report-Only", value: politicaContenido },
        ],
      },
    ];
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      // Default 1 MB trunca PDFs multipart hasta 5 MB (RN46). Margen sobre el tope de producto.
      bodySizeLimit: "6mb",
    },
  },
  // Silencia el aviso de lockfile en el home del usuario; imports CSS usan rutas en globals.css.
  turbopack: {
    root: projectRoot,
    // pdfjs / optional Node deps: evita resolver el paquete nativo `canvas` en el cliente (Turbopack).
    resolveAlias: {
      canvas: canvasStub,
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
};

// Serwist: excluye esbuild del bundle del servidor (compila el service worker en app/serwist).
export default withSerwist(nextConfig);
