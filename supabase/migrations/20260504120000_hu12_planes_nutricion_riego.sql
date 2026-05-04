-- HU12 RF12: planes de nutrición y riego por lote (RN32–RN34), RLS alineado a planes_siembra.

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_nutricion_dosis_unidad') THEN
    CREATE TYPE public.plan_nutricion_dosis_unidad AS ENUM ('por_ha', 'por_palma');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_nutricion_frecuencia') THEN
    CREATE TYPE public.plan_nutricion_frecuencia AS ENUM (
      'once',
      'semanal',
      'quincenal',
      'mensual',
      'personalizado'
    );
  END IF;
END
$guard$;

COMMENT ON TYPE public.plan_nutricion_dosis_unidad IS 'RN33 HU12: dosis por hectárea o por palma.';

-- -----------------------------------------------------------------------------
-- Cabecera plan nutrición / riego
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planes_nutricion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  nombre text,
  fecha_inicio date,
  fecha_fin date,
  notas text,
  locked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.planes_nutricion IS 'HU12 RF12: plan de fertilización y calendario de riego por lote.';
COMMENT ON COLUMN public.planes_nutricion.locked_at IS 'RF22: se establecerá al registrar primera aplicación; bloquea edición del plan.';

CREATE INDEX IF NOT EXISTS planes_nutricion_finca_lote_idx
  ON public.planes_nutricion (finca_id, lote_id)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS planes_nutricion_finca_created_idx
  ON public.planes_nutricion (finca_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_planes_nutricion_lote_finca ON public.planes_nutricion;
CREATE TRIGGER trg_planes_nutricion_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.planes_nutricion
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lote_matches_finca();

-- -----------------------------------------------------------------------------
-- Líneas fertilización (solo insumos nutrición validados en app, RN32)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planes_nutricion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.planes_nutricion (id) ON DELETE CASCADE,
  catalogo_insumo_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  dosis_cantidad numeric(14, 4) NOT NULL,
  dosis_unidad public.plan_nutricion_dosis_unidad NOT NULL,
  frecuencia public.plan_nutricion_frecuencia NOT NULL DEFAULT 'once',
  fecha_objetivo date,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.planes_nutricion_items IS 'HU12: líneas de fertilización programada (dosis, unidad, frecuencia).';

CREATE INDEX IF NOT EXISTS planes_nutricion_items_plan_idx ON public.planes_nutricion_items (plan_id);

-- -----------------------------------------------------------------------------
-- Líneas riego
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planes_riego_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.planes_nutricion (id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  intervalo_dias integer,
  proxima_fecha date NOT NULL,
  volumen_o_tiempo text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.planes_riego_items IS 'HU12: ciclos o eventos de riego programados por plan.';

CREATE INDEX IF NOT EXISTS planes_riego_items_plan_idx ON public.planes_riego_items (plan_id);

-- -----------------------------------------------------------------------------
-- RLS planes_nutricion
-- -----------------------------------------------------------------------------
ALTER TABLE public.planes_nutricion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planes_nutricion_select ON public.planes_nutricion;
CREATE POLICY planes_nutricion_select ON public.planes_nutricion
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS planes_nutricion_insert ON public.planes_nutricion;
CREATE POLICY planes_nutricion_insert ON public.planes_nutricion
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

DROP POLICY IF EXISTS planes_nutricion_update ON public.planes_nutricion;
CREATE POLICY planes_nutricion_update ON public.planes_nutricion
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

-- -----------------------------------------------------------------------------
-- RLS items (vía plan padre)
-- -----------------------------------------------------------------------------
ALTER TABLE public.planes_nutricion_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planes_nutricion_items_select ON public.planes_nutricion_items;
CREATE POLICY planes_nutricion_items_select ON public.planes_nutricion_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planes_nutricion pn
      WHERE pn.id = plan_id
        AND (public.is_superadmin() OR pn.finca_id = public.current_user_finca_id())
    )
  );

DROP POLICY IF EXISTS planes_nutricion_items_insert ON public.planes_nutricion_items;
CREATE POLICY planes_nutricion_items_insert ON public.planes_nutricion_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planes_nutricion pn
      WHERE pn.id = plan_id
        AND pn.is_voided = false
        AND pn.locked_at IS NULL
        AND (
          public.is_superadmin()
          OR (
            pn.finca_id = public.current_user_finca_id()
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.is_active = true
                AND p.role = 'agronomo'::public.user_role
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS planes_nutricion_items_delete ON public.planes_nutricion_items;
CREATE POLICY planes_nutricion_items_delete ON public.planes_nutricion_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planes_nutricion pn
      WHERE pn.id = plan_id
        AND pn.is_voided = false
        AND pn.locked_at IS NULL
        AND (
          public.is_superadmin()
          OR (
            pn.finca_id = public.current_user_finca_id()
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.is_active = true
                AND p.role = 'agronomo'::public.user_role
            )
          )
        )
    )
  );

ALTER TABLE public.planes_riego_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planes_riego_items_select ON public.planes_riego_items;
CREATE POLICY planes_riego_items_select ON public.planes_riego_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planes_nutricion pn
      WHERE pn.id = plan_id
        AND (public.is_superadmin() OR pn.finca_id = public.current_user_finca_id())
    )
  );

DROP POLICY IF EXISTS planes_riego_items_insert ON public.planes_riego_items;
CREATE POLICY planes_riego_items_insert ON public.planes_riego_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planes_nutricion pn
      WHERE pn.id = plan_id
        AND pn.is_voided = false
        AND pn.locked_at IS NULL
        AND (
          public.is_superadmin()
          OR (
            pn.finca_id = public.current_user_finca_id()
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.is_active = true
                AND p.role = 'agronomo'::public.user_role
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS planes_riego_items_delete ON public.planes_riego_items;
CREATE POLICY planes_riego_items_delete ON public.planes_riego_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planes_nutricion pn
      WHERE pn.id = plan_id
        AND pn.is_voided = false
        AND pn.locked_at IS NULL
        AND (
          public.is_superadmin()
          OR (
            pn.finca_id = public.current_user_finca_id()
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.is_active = true
                AND p.role = 'agronomo'::public.user_role
            )
          )
        )
    )
  );
