-- =============================================================================
-- SIG-Palma: scope admin access to their assigned finca while keeping
-- superadmin as the only global role.
-- Migration: 20260420213000
-- Depends on:
--   - 20260420000000_add_superadmin_catalogos_suelo.sql
--   - 20260420210000_enforce_single_superadmin_and_admin_finca.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: finca-scoped admin (not superadmin)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_finca_admin()
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
      AND p.role = 'admin'::public.user_role
      AND p.finca_id IS NOT NULL
  );
$$;

-- -----------------------------------------------------------------------------
-- Fincas: only superadmin creates/edits; admins only see their assigned finca
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS fincas_select ON public.fincas;
CREATE POLICY fincas_select ON public.fincas
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS fincas_insert ON public.fincas;
CREATE POLICY fincas_insert ON public.fincas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS fincas_update ON public.fincas;
CREATE POLICY fincas_update ON public.fincas
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- Profiles: superadmin sees all; finca admin sees users from own finca only
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_superadmin()
    OR (
      public.is_finca_admin()
      AND finca_id = public.current_user_finca_id()
      AND role <> 'superadmin'::public.user_role
    )
  );

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR public.is_superadmin()
    OR (
      public.is_finca_admin()
      AND finca_id = public.current_user_finca_id()
      AND role NOT IN ('admin'::public.user_role, 'superadmin'::public.user_role)
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR public.is_superadmin()
    OR (
      public.is_finca_admin()
      AND finca_id = public.current_user_finca_id()
      AND role NOT IN ('admin'::public.user_role, 'superadmin'::public.user_role)
    )
  );

-- -----------------------------------------------------------------------------
-- Lotes: superadmin global, admin/agronomo scoped to own finca
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS lotes_select ON public.lotes;
CREATE POLICY lotes_select ON public.lotes
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS lotes_insert ON public.lotes;
CREATE POLICY lotes_insert ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
      )
    )
  );

DROP POLICY IF EXISTS lotes_update ON public.lotes;
CREATE POLICY lotes_update ON public.lotes
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- Labores: superadmin can see/update globally; finca users operate inside finca
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS labores_select ON public.labores_agronomicas;
CREATE POLICY labores_select ON public.labores_agronomicas
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS labores_insert ON public.labores_agronomicas;
CREATE POLICY labores_insert ON public.labores_agronomicas
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_superadmin()
    AND NOT public.is_finca_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
    )
  );

DROP POLICY IF EXISTS labores_update ON public.labores_agronomicas;
CREATE POLICY labores_update ON public.labores_agronomicas
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- Cosechas
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS cosechas_select ON public.cosechas_rff;
CREATE POLICY cosechas_select ON public.cosechas_rff
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS cosechas_insert ON public.cosechas_rff;
CREATE POLICY cosechas_insert ON public.cosechas_rff
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_superadmin()
    AND NOT public.is_finca_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
    )
  );

DROP POLICY IF EXISTS cosechas_update ON public.cosechas_rff;
CREATE POLICY cosechas_update ON public.cosechas_rff
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- Alertas
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS alertas_select ON public.alertas_fitosanitarias;
CREATE POLICY alertas_select ON public.alertas_fitosanitarias
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS alertas_insert ON public.alertas_fitosanitarias;
CREATE POLICY alertas_insert ON public.alertas_fitosanitarias
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_superadmin()
    AND NOT public.is_finca_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
    )
  );

DROP POLICY IF EXISTS alertas_update ON public.alertas_fitosanitarias;
CREATE POLICY alertas_update ON public.alertas_fitosanitarias
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- Analisis de suelo
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS analisis_suelo_select ON public.analisis_suelo;
CREATE POLICY analisis_suelo_select ON public.analisis_suelo
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS analisis_suelo_insert ON public.analisis_suelo;
CREATE POLICY analisis_suelo_insert ON public.analisis_suelo
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_superadmin()
      OR (
        finca_id = public.current_user_finca_id()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_active = true
            AND p.role IN ('agronomo'::public.user_role, 'admin'::public.user_role)
        )
      )
    )
  );

DROP POLICY IF EXISTS analisis_suelo_update ON public.analisis_suelo;
CREATE POLICY analisis_suelo_update ON public.analisis_suelo
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'admin'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );
