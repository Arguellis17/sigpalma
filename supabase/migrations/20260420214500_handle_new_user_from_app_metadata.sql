-- =============================================================================
-- SIG-Palma: create profiles from auth.users using app_metadata role/finca
-- Migration: 20260420214500
-- Depends on: 20260420210000_enforce_single_superadmin_and_admin_finca.sql
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
BEGIN
  v_role := COALESCE(
    NULLIF(NEW.raw_app_meta_data->>'role', '')::public.user_role,
    'operario'::public.user_role
  );

  v_finca_id := NULLIF(NEW.raw_app_meta_data->>'finca_id', '')::uuid;
  v_documento_identidad := NULLIF(NEW.raw_app_meta_data->>'documento_identidad', '');

  IF v_role <> 'superadmin'::public.user_role AND v_finca_id IS NULL THEN
    RAISE EXCEPTION 'Los usuarios no superadmin deben crearse con finca_id en app_metadata';
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