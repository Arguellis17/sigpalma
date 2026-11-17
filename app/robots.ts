import type { MetadataRoute } from "next";

/** Plataforma privada: solo la pantalla de acceso es rastreable; el resto requiere sesión. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/auth/login", disallow: "/" }] };
}
