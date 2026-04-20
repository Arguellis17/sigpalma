-- =============================================================================
-- SIG-Palma: fix handle_new_user for admin.createUser()
-- Migration: 20260420230000
--
-- GoTrue applies app_metadata in a second UPDATE after the auth.users INSERT.
-- AFTER INSERT triggers therefore often see empty raw_app_meta_data, so role and
-- finca_id were missing and the trigger failed (or inserted operario sin finca).
-- We duplicate role/finca into user_metadata as sp_role / sp_finca_id (present
-- on INSERT) and read them first, with fallback to app_metadata for older flows.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role public.user_role;
  v_finca_id uuid;
  v_documento_identidad text;
  v_role_txt text;
BEGIN
  v_role_txt := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'sp_role', ''),
    NULLIF(NEW.raw_app_meta_data->>'role', '')
  );

  v_role := COALESCE(
    NULLIF(v_role_txt, '')::public.user_role,
    'operario'::public.user_role
  );

  v_finca_id := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'sp_finca_id', '')::uuid,
    NULLIF(NEW.raw_app_meta_data->>'finca_id', '')::uuid
  );

  v_documento_identidad := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'sp_documento_identidad', ''),
    NULLIF(NEW.raw_app_meta_data->>'documento_identidad', '')
  );

  IF v_role <> 'superadmin'::public.user_role AND v_finca_id IS NULL THEN
    RAISE EXCEPTION 'Los usuarios no superadmin deben crearse con finca (sp_finca_id en user_metadata o finca_id en app_metadata)';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, finca_id, documento_identidad)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    v_finca_id,
    v_documento_identidad
  );
  RETURN NEW;
END;
$$;
