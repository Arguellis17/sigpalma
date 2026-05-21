-- HU21 / RF21: ejecución de labores con cantidad y unidad (RN59–RN61).

ALTER TABLE public.labores_agronomicas
  ADD COLUMN IF NOT EXISTS cantidad_ejecutada numeric(14, 4),
  ADD COLUMN IF NOT EXISTS unidad_medida text,
  ADD COLUMN IF NOT EXISTS ejecutada_at timestamptz;

COMMENT ON COLUMN public.labores_agronomicas.cantidad_ejecutada IS
  'RN60: avance reportado por el operario (palmas o hectáreas). NULL = programación pendiente (HU11).';

COMMENT ON COLUMN public.labores_agronomicas.unidad_medida IS
  'RN60: unidad del avance (palmas, ha).';

COMMENT ON COLUMN public.labores_agronomicas.ejecutada_at IS
  'Marca de tiempo del reporte de ejecución en campo.';

ALTER TABLE public.labores_agronomicas
  DROP CONSTRAINT IF EXISTS labores_agronomicas_unidad_medida_chk;

ALTER TABLE public.labores_agronomicas
  ADD CONSTRAINT labores_agronomicas_unidad_medida_chk CHECK (
    unidad_medida IS NULL OR unidad_medida IN ('palmas', 'ha')
  );

ALTER TABLE public.labores_agronomicas
  DROP CONSTRAINT IF EXISTS labores_agronomicas_cantidad_ejecutada_chk;

ALTER TABLE public.labores_agronomicas
  ADD CONSTRAINT labores_agronomicas_cantidad_ejecutada_chk CHECK (
    cantidad_ejecutada IS NULL OR cantidad_ejecutada > 0
  );

ALTER TABLE public.labores_agronomicas
  DROP CONSTRAINT IF EXISTS labores_agronomicas_ejecucion_coherente_chk;

ALTER TABLE public.labores_agronomicas
  ADD CONSTRAINT labores_agronomicas_ejecucion_coherente_chk CHECK (
    (cantidad_ejecutada IS NULL AND unidad_medida IS NULL AND ejecutada_at IS NULL)
    OR (
      cantidad_ejecutada IS NOT NULL
      AND unidad_medida IS NOT NULL
      AND ejecutada_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS labores_pendientes_ejecucion_idx
  ON public.labores_agronomicas (finca_id, fecha_ejecucion)
  WHERE is_voided = false
    AND catalogo_item_id IS NOT NULL
    AND cantidad_ejecutada IS NULL;
