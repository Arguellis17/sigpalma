import type { NextConfig } from "next";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.dirname(require.resolve("./package.json"));
const canvasStub = path.join(projectRoot, "stubs/canvas-empty.js");

const nextConfig: NextConfig = {
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

export default nextConfig;
