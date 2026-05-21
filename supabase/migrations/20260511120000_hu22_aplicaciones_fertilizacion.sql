-- HU22 / RF22: aplicaciones de fertilización ejecutadas en campo (RN62–RN64).

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metodo_aplicacion_fertilizacion') THEN
    CREATE TYPE public.metodo_aplicacion_fertilizacion AS ENUM (
      'manual',
      'equipada',
      'fertirriego',
      'otro'
    );
  END IF;
END
$guard$;

COMMENT ON TYPE public.metodo_aplicacion_fertilizacion IS
  'RN64 HU22: método de aplicación del fertilizante en campo.';

CREATE TABLE IF NOT EXISTS public.aplicaciones_fertilizacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.planes_nutricion (id) ON DELETE RESTRICT,
  plan_item_id uuid NOT NULL REFERENCES public.planes_nutricion_items (id) ON DELETE RESTRICT,
  catalogo_insumo_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  fecha_aplicacion date NOT NULL,
  cantidad_aplicada numeric(14, 4) NOT NULL,
  dosis_programada numeric(14, 4) NOT NULL,
  dosis_unidad public.plan_nutricion_dosis_unidad NOT NULL,
  desviacion_pct numeric(6, 2) NOT NULL DEFAULT 0,
  justificacion_desviacion text,
  metodo_aplicacion public.metodo_aplicacion_fertilizacion NOT NULL,
  unidad_medida text,
  latitud numeric(10, 7) NOT NULL,
  longitud numeric(10, 7) NOT NULL,
  notas text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aplicaciones_fertilizacion_cantidad_chk CHECK (cantidad_aplicada > 0),
  CONSTRAINT aplicaciones_fertilizacion_plan_item_unique UNIQUE (plan_item_id)
);

COMMENT ON TABLE public.aplicaciones_fertilizacion IS
  'HU22 RF22: registro de fertilización ejecutada vinculada al plan nutricional (HU12).';

CREATE INDEX IF NOT EXISTS aplicaciones_fertilizacion_finca_fecha_idx
  ON public.aplicaciones_fertilizacion (finca_id, fecha_aplicacion DESC)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS aplicaciones_fertilizacion_lote_idx
  ON public.aplicaciones_fertilizacion (lote_id, fecha_aplicacion DESC)
  WHERE is_voided = false;

DROP TRIGGER IF EXISTS trg_aplicaciones_fertilizacion_lote_finca ON public.aplicaciones_fertilizacion;
CREATE TRIGGER trg_aplicaciones_fertilizacion_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.aplicaciones_fertilizacion
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

CREATE OR REPLACE FUNCTION public.trg_aplicacion_fertilizacion_lock_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.planes_nutricion
  SET locked_at = now(),
      updated_at = now()
  WHERE id = NEW.plan_id
    AND locked_at IS NULL
    AND is_voided = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicacion_fertilizacion_lock_plan ON public.aplicaciones_fertilizacion;
CREATE TRIGGER trg_aplicacion_fertilizacion_lock_plan
  AFTER INSERT ON public.aplicaciones_fertilizacion
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aplicacion_fertilizacion_lock_plan();

ALTER TABLE public.aplicaciones_fertilizacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aplicaciones_fertilizacion_select ON public.aplicaciones_fertilizacion;
CREATE POLICY aplicaciones_fertilizacion_select ON public.aplicaciones_fertilizacion
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS aplicaciones_fertilizacion_insert ON public.aplicaciones_fertilizacion;
CREATE POLICY aplicaciones_fertilizacion_insert ON public.aplicaciones_fertilizacion
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
      )
      AND EXISTS (
        SELECT 1 FROM public.planes_nutricion pn
        WHERE pn.id = plan_id
          AND pn.finca_id = public.current_user_finca_id()
          AND pn.is_voided = false
      )
    )
  );

DROP POLICY IF EXISTS aplicaciones_fertilizacion_update ON public.aplicaciones_fertilizacion;
CREATE POLICY aplicaciones_fertilizacion_update ON public.aplicaciones_fertilizacion
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );
