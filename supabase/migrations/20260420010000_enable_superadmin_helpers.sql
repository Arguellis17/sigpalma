-- =============================================================================
-- SIG-Palma: enable helper functions/policies that depend on user_role.superadmin
-- Migration: 20260420010000
-- Depends on: 20260420000000_add_superadmin_catalogos_suelo.sql
-- =============================================================================

-- Update is_admin() helper to include superadmin
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

-- Add is_superadmin() helper
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

-- Storage: evidencia-tecnica — explicitly include superadmin in role checks
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