-- HU14 RF14 / CU14 — Evaluación de vivero (semillero).
-- RF18 — Registro mínimo de germinación / tratamiento térmico (precondición HU14).

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vivero_concepto_evaluacion') THEN
    CREATE TYPE public.vivero_concepto_evaluacion AS ENUM (
      'apto_trasplante',
      'no_apto'
    );
  END IF;
END
$guard$;

COMMENT ON TYPE public.vivero_concepto_evaluacion IS 'HU14 RN40: concepto técnico emitido tras evaluación de vivero.';

CREATE TABLE IF NOT EXISTS public.registros_germinacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  catalogo_material_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  lote_id uuid REFERENCES public.lotes (id) ON DELETE SET NULL,
  fecha_tratamiento date NOT NULL,
  temperatura_max_c numeric(5, 2) NOT NULL,
  dias_tratamiento integer NOT NULL CHECK (dias_tratamiento > 0 AND dias_tratamiento <= 365),
  notas text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.registros_germinacion IS 'RF18: tratamiento térmico de semilla (precondición HU14 / L1159 LINEAMIENTO).';

CREATE OR REPLACE FUNCTION public.enforce_registro_germinacion_material_genetico()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalogo_items c
    WHERE c.id = NEW.catalogo_material_id
      AND c.categoria = 'material_genetico'::public.catalogo_categoria
      AND c.activo = true
  ) THEN
    RAISE EXCEPTION 'Solo material genético activo del catálogo (RF06).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registros_germinacion_material_cat ON public.registros_germinacion;
CREATE TRIGGER trg_registros_germinacion_material_cat
  BEFORE INSERT OR UPDATE OF catalogo_material_id ON public.registros_germinacion
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_registro_germinacion_material_genetico();

CREATE INDEX IF NOT EXISTS registros_germinacion_finca_material_idx
  ON public.registros_germinacion (finca_id, catalogo_material_id)
  WHERE is_voided = false;

DROP TRIGGER IF EXISTS trg_registros_germinacion_lote_finca ON public.registros_germinacion;
CREATE TRIGGER trg_registros_germinacion_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.registros_germinacion
  FOR EACH ROW
  WHEN (NEW.lote_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

CREATE TABLE IF NOT EXISTS public.evaluaciones_vivero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  germinacion_id uuid NOT NULL REFERENCES public.registros_germinacion (id) ON DELETE RESTRICT,
  total_inicial integer NOT NULL CHECK (total_inicial > 0),
  unidades_germinadas integer NOT NULL CHECK (unidades_germinadas >= 0),
  unidades_descartadas integer NOT NULL CHECK (unidades_descartadas >= 0),
  pct_germinacion numeric(7, 4) GENERATED ALWAYS AS (
    CASE
      WHEN total_inicial > 0 THEN round((100.0 * unidades_germinadas::numeric / total_inicial::numeric), 4)
      ELSE 0::numeric
    END
  ) STORED,
  motivo_descarte text,
  observaciones_fitosanitarias text,
  concepto public.vivero_concepto_evaluacion NOT NULL,
  evidencia_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluaciones_vivero_conteo_chk CHECK (
    unidades_germinadas + unidades_descartadas <= total_inicial
  ),
  CONSTRAINT evaluaciones_vivero_rn39_motivo_chk CHECK (
    unidades_descartadas = 0
    OR (motivo_descarte IS NOT NULL AND length(btrim(motivo_descarte)) >= 3)
  )
);

COMMENT ON TABLE public.evaluaciones_vivero IS 'HU14 RF14 / CU14: acta de evaluación de vivero (RN38–RN40).';
COMMENT ON COLUMN public.evaluaciones_vivero.evidencia_urls IS 'CU14.1: URLs en Storage (bucket evidencia-tecnica), JSON array de strings.';

CREATE UNIQUE INDEX IF NOT EXISTS evaluaciones_vivero_germinacion_activa_uidx
  ON public.evaluaciones_vivero (germinacion_id)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS evaluaciones_vivero_finca_concepto_idx
  ON public.evaluaciones_vivero (finca_id, concepto)
  WHERE is_voided = false;

DROP TRIGGER IF EXISTS trg_evaluaciones_vivero_germinacion_finca ON public.evaluaciones_vivero;
CREATE OR REPLACE FUNCTION public.enforce_evaluacion_vivero_germinacion_finca()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  g_finca uuid;
BEGIN
  SELECT r.finca_id INTO g_finca
  FROM public.registros_germinacion r
  WHERE r.id = NEW.germinacion_id;

  IF g_finca IS NULL THEN
    RAISE EXCEPTION 'Registro de germinación no encontrado.';
  END IF;

  IF NEW.finca_id IS DISTINCT FROM g_finca THEN
    RAISE EXCEPTION 'La finca de la evaluación debe coincidir con la del registro de germinación (RF18).';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evaluaciones_vivero_germinacion_finca
  BEFORE INSERT OR UPDATE OF germinacion_id, finca_id ON public.evaluaciones_vivero
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_evaluacion_vivero_germinacion_finca();

-- -----------------------------------------------------------------------------
-- RLS registros_germinacion (RF18: operario u agrónomo de la finca)
-- -----------------------------------------------------------------------------
ALTER TABLE public.registros_germinacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registros_germinacion_select ON public.registros_germinacion;
CREATE POLICY registros_germinacion_select ON public.registros_germinacion
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS registros_germinacion_insert ON public.registros_germinacion;
CREATE POLICY registros_germinacion_insert ON public.registros_germinacion
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_superadmin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('operario'::public.user_role, 'agronomo'::public.user_role)
    )
  );

DROP POLICY IF EXISTS registros_germinacion_update ON public.registros_germinacion;
CREATE POLICY registros_germinacion_update ON public.registros_germinacion
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
            AND p.role = 'agronomo'::public.user_role
        )
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- RLS evaluaciones_vivero (solo técnico agrónomo / admin finca; no operario insert)
-- -----------------------------------------------------------------------------
ALTER TABLE public.evaluaciones_vivero ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evaluaciones_vivero_select ON public.evaluaciones_vivero;
CREATE POLICY evaluaciones_vivero_select ON public.evaluaciones_vivero
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS evaluaciones_vivero_insert ON public.evaluaciones_vivero;
CREATE POLICY evaluaciones_vivero_insert ON public.evaluaciones_vivero
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_superadmin()
    AND NOT public.is_finca_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role = 'agronomo'::public.user_role
    )
  );

DROP POLICY IF EXISTS evaluaciones_vivero_update ON public.evaluaciones_vivero;
CREATE POLICY evaluaciones_vivero_update ON public.evaluaciones_vivero
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role = 'agronomo'::public.user_role
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );
