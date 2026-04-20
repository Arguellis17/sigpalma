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
-- 4. Update is_admin() helper to include superadmin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND p.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. Add is_superadmin() helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND p.role = 'superadmin'::public.user_role
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. RLS for analisis_suelo
-- -----------------------------------------------------------------------------
ALTER TABLE public.analisis_suelo ENABLE ROW LEVEL SECURITY;

-- Superadmin + admin see all; agronomo sees their finca
DROP POLICY IF EXISTS analisis_suelo_select ON public.analisis_suelo;
CREATE POLICY analisis_suelo_select ON public.analisis_suelo
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

-- Only agronomo (and admin/superadmin for migration purposes) can INSERT
DROP POLICY IF EXISTS analisis_suelo_insert ON public.analisis_suelo;
CREATE POLICY analisis_suelo_insert ON public.analisis_suelo
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND finca_id = public.current_user_finca_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'admin'::public.user_role, 'superadmin'::public.user_role)
    )
  );

DROP POLICY IF EXISTS analisis_suelo_update ON public.analisis_suelo;
CREATE POLICY analisis_suelo_update ON public.analisis_suelo
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'admin'::public.user_role, 'superadmin'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- 7. Update existing RLS policies to grant superadmin full access
--    (is_admin() now returns true for superadmin, so policies relying on
--     is_admin() are already updated. Only need to patch policies that use
--     explicit role checks.)
-- -----------------------------------------------------------------------------

-- Lotes insert/update: explicit role check needs superadmin
DROP POLICY IF EXISTS lotes_insert ON public.lotes;
CREATE POLICY lotes_insert ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN (
            'admin'::public.user_role,
            'agronomo'::public.user_role,
            'superadmin'::public.user_role
          )
      )
    )
  );

DROP POLICY IF EXISTS lotes_update ON public.lotes;
CREATE POLICY lotes_update ON public.lotes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN (
            'admin'::public.user_role,
            'agronomo'::public.user_role,
            'superadmin'::public.user_role
          )
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

-- Catalogo write: superadmin included
DROP POLICY IF EXISTS catalogo_write ON public.catalogo_items;
CREATE POLICY catalogo_write ON public.catalogo_items
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'superadmin'::public.user_role)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'superadmin'::public.user_role)
    )
  );

-- Profiles: superadmin can update any profile
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Profiles INSERT (needed for superadmin creating admins via trigger)
-- The on_auth_user_created trigger is SECURITY DEFINER, so no RLS change needed there.

-- Storage: evidencia-tecnica — superadmin can also insert
DROP POLICY IF EXISTS evidencia_insert ON storage.objects;
CREATE POLICY evidencia_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencia-tecnica'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN (
          'admin'::public.user_role,
          'agronomo'::public.user_role,
          'superadmin'::public.user_role
        )
    )
  );

DROP POLICY IF EXISTS evidencia_update ON storage.objects;
CREATE POLICY evidencia_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'evidencia-tecnica'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN (
          'admin'::public.user_role,
          'agronomo'::public.user_role,
          'superadmin'::public.user_role
        )
    )
  );

DROP POLICY IF EXISTS evidencia_delete ON storage.objects;
CREATE POLICY evidencia_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidencia-tecnica'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('admin'::public.user_role, 'superadmin'::public.user_role)
    )
  );
