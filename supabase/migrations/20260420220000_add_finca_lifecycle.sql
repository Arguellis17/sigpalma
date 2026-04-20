-- Add lifecycle column to fincas for logical archive/inactivation
-- Hard deletes are impossible due to ON DELETE RESTRICT FKs from lotes, labores, cosechas, etc.

ALTER TABLE public.fincas
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS fincas_is_active_idx ON public.fincas (is_active);

COMMENT ON COLUMN public.fincas.is_active IS 'Soft-delete flag: false means archived/inactivated (no physical deletion allowed)';
