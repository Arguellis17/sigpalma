-- =============================================================================
-- SIG-Palma: Add superadmin role, extended catalogo_items, analisis_suelo table
-- Migration: 20260420000000
-- Depends on: 20260415180000_init_sigpalma_core.sql (already applied)
-- =============================================================================

-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction in Postgres.
-- Supabase migrations run each file in a transaction by default.
-- The DO $$ block pattern works around this by using psql's COMMIT-like behavior.
-- On hosted Supabase Cloud, run this file via the SQL editor.

-- -----------------------------------------------------------------------------
-- 1. Add 'superadmin' to user_role enum
-- -----------------------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'superadmin' BEFORE 'admin';

-- -----------------------------------------------------------------------------
-- 2. Extend catalogo_items with nullable columns for each category
--    These columns are used selectively based on `categoria`:
--    - insumo:           subcategoria, unidad_medida
--    - material_genetico: proveedor, anio_adquisicion
--    - plaga/enfermedad:  sintomas
-- -----------------------------------------------------------------------------
ALTER TABLE public.catalogo_items
  ADD COLUMN IF NOT EXISTS subcategoria   text,
  ADD COLUMN IF NOT EXISTS unidad_medida  text,
  ADD COLUMN IF NOT EXISTS proveedor      text,
  ADD COLUMN IF NOT EXISTS anio_adquisicion integer,
  ADD COLUMN IF NOT EXISTS sintomas       text;

-- -----------------------------------------------------------------------------
-- 3. Create analisis_suelo table (HU16)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analisis_suelo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id          uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id           uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  fecha_analisis    date NOT NULL,
  ph                numeric(4, 2)  CHECK (ph IS NULL OR (ph >= 0 AND ph <= 14)),
  humedad_pct       numeric(5, 2)  CHECK (humedad_pct IS NULL OR (humedad_pct >= 0 AND humedad_pct <= 100)),
  compactacion      text,
  -- Macro/micro nutrientes en JSON flexible: {N, P, K, Ca, Mg, S, Fe, Mn, ...}
  nutrientes        jsonb,
  -- Path al archivo en Supabase Storage bucket 'evidencia-tecnica'
  archivo_url       text,
  notas             text,
  created_by        uuid NOT NULL REFERENCES auth.users (id),
  source            public.registro_source NOT NULL DEFAULT 'web',
  is_voided         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analisis_suelo_lote_fecha_idx
  ON public.analisis_suelo (lote_id, fecha_analisis DESC);

CREATE INDEX IF NOT EXISTS analisis_suelo_finca_idx
  ON public.analisis_suelo (finca_id);

-- Enforce lote belongs to finca (reuses existing function)
DROP TRIGGER IF EXISTS trg_analisis_suelo_lote_finca ON public.analisis_suelo;
CREATE TRIGGER trg_analisis_suelo_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.analisis_suelo
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

-- -----------------------------------------------------------------------------
-- 4. RLS/policy updates that reference the new enum value are intentionally
--    deferred to a follow-up migration. Postgres does not allow using a freshly
--    added enum value inside the same transaction that adds it.
-- -----------------------------------------------------------------------------
ALTER TABLE public.analisis_suelo ENABLE ROW LEVEL SECURITY;
