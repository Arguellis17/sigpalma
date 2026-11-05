import type { MetadataRoute } from "next";

/** Manifiesto de la PWA: permite instalar SIG-Palma en el teléfono o el escritorio. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SIG-Palma",
    short_name: "SIG-Palma",
    description: "Gestión técnica y trazabilidad del cultivo de palma de aceite, también sin conexión.",
    lang: "es-CO",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#1f5f3f",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
