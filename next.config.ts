import type { NextConfig } from "next";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.dirname(require.resolve("./package.json"));

const nextConfig: NextConfig = {
  // Silencia el aviso de lockfile en el home del usuario; imports CSS usan rutas en globals.css.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
