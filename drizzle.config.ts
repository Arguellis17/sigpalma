import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit: Studio, introspección y (si se decide) migraciones SQL generadas.
 * Conexión: URI Postgres directa (Supabase → Dashboard → Database → URI, puerto 5432).
 * No uses el pooler (6543) para migraciones largas si el proveedor lo desaconseja.
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
});
