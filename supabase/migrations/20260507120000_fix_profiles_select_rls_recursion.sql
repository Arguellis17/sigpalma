-- =============================================================================
-- SIG-Palma: fix 42P17 infinite recursion on public.profiles RLS
-- Migration: 20260507120000
-- Depends on: 20260505120000_hu13_monitoreos_fitosanitarios_programados.sql
-- Cause: profiles_select_own embedded EXISTS (SELECT FROM profiles …), which
--        re-evaluates the same policy. Move that check into SECURITY DEFINER.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: active agrónomo (for profiles_select_own; avoids self-referential RLS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_agronomo()
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
      AND p.role = 'agronomo'::public.user_role
  );
$$;

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
    OR (
      finca_id = public.current_user_finca_id()
      AND role = 'operario'::public.user_role
      AND public.is_active_agronomo()
    )
  );
