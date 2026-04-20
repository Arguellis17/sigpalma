-- =============================================================================
-- SIG-Palma: Add documento_identidad to profiles
-- Migration: 20260420200000
-- Depends on: 20260415180000_init_sigpalma_core.sql
-- Purpose: HU01 — users can log in with their national ID or email.
-- =============================================================================

-- 1. Add column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS documento_identidad text;

-- 2. Unique index (only among non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_documento_identidad_unique
  ON public.profiles (documento_identidad)
  WHERE documento_identidad IS NOT NULL;

-- 3. Helper function: given an identifier (email or documento), return the email
--    stored in auth.users for that profile. Used by the login Server Action.
--    SECURITY DEFINER so it can read auth.users from the public schema context.
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Try email first (auth.users lookup)
  SELECT au.email INTO v_email
  FROM auth.users au
  WHERE lower(au.email) = lower(p_identifier)
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Try documento_identidad → profiles → auth.users
  SELECT au.email INTO v_email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.documento_identidad = p_identifier
    AND p.is_active = true
  LIMIT 1;

  RETURN v_email; -- NULL if not found
END;
$$;

-- Restrict to authenticated callers and the anon key (login page uses anon key)
REVOKE ALL ON FUNCTION public.resolve_login_identifier(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO authenticated;

-- 4. Update trigger so new users propagate (already exists; just ensure column
--    default is NULL which is implicit for text with no DEFAULT clause).

COMMENT ON COLUMN public.profiles.documento_identidad IS
  'Número de cédula o documento de identidad. Permite al usuario autenticarse con CC o correo.';
