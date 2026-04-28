-- HU11: lotes activos (RN29), enum labor, FK opcional en labores_agronomicas.
--
-- PostgreSQL no permite usar un valor de enum recién añadido en la MISMA transacción
-- (55P04). Las semillas de catalogo_items van en un archivo posterior que/commit aparte.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'catalogo_categoria'
      AND e.enumlabel = 'labor'
  ) THEN
    ALTER TYPE public.catalogo_categoria ADD VALUE 'labor';
  END IF;
END
$migration$;

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.lotes.activo IS 'RN29: solo lotes activos admiten nuevas programaciones de labores.';

CREATE INDEX IF NOT EXISTS lotes_finca_activo_idx ON public.lotes (finca_id) WHERE activo = true;

ALTER TABLE public.labores_agronomicas
  ADD COLUMN IF NOT EXISTS catalogo_item_id uuid REFERENCES public.catalogo_items (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS labores_catalogo_item_idx ON public.labores_agronomicas (catalogo_item_id);

COMMENT ON COLUMN public.labores_agronomicas.catalogo_item_id IS 'Ítem de catalogo_items.categoria=labor asociado (RN30); tipo sigue almacenando el nombre para compatibilidad.';
