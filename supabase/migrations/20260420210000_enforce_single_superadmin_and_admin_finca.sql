-- =============================================================================
-- SIG-Palma: enforce single superadmin and finca assignment for non-superadmin
-- Migration: 20260420210000
-- Depends on: 20260420000000_add_superadmin_catalogos_suelo.sql
-- Purpose:
--   1. Only one superadmin may exist in the platform.
--   2. Superadmin is global and must not have finca_id.
--   3. Every non-superadmin user must have a finca_id.
--
-- NOTE:
--   The finca constraint for non-superadmin users is added as NOT VALID so the
--   migration applies cleanly even if an existing admin still has finca_id NULL.
--   It will still be enforced for NEW rows and future updates.
--   After assigning finca_id to any legacy admin rows, run:
--     ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_non_superadmin_requires_finca_chk;
-- =============================================================================

-- Superadmin must be global (no finca attached)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_superadmin_no_finca_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_superadmin_no_finca_chk
      CHECK (role <> 'superadmin'::public.user_role OR finca_id IS NULL);
  END IF;
END
$$;

-- Every non-superadmin user must belong to a finca
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_non_superadmin_requires_finca_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_non_superadmin_requires_finca_chk
      CHECK (role = 'superadmin'::public.user_role OR finca_id IS NOT NULL)
      NOT VALID;
  END IF;
END
$$;

-- Only one superadmin may exist
CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_superadmin_idx
  ON public.profiles ((true))
  WHERE role = 'superadmin'::public.user_role;
