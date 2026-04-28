-- HU10: estados de cultivo del lote (RN26), tabla planes_siembra (RF10), RLS.

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lote_estado_cultivo') THEN
    CREATE TYPE public.lote_estado_cultivo AS ENUM (
      'vacante',
      'disponible',
      'planificado_siembra',
      'en_produccion'
    );
  END IF;
END
$guard$;

COMMENT ON TYPE public.lote_estado_cultivo IS
  'RN26: solo vacante/disponible admiten nueva planificación de siembra; planificado_siembra tras HU10; en_produccion cultivo establecido.';

ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS estado_cultivo public.lote_estado_cultivo NOT NULL DEFAULT 'en_produccion';

COMMENT ON COLUMN public.lotes.estado_cultivo IS
  'Estado agronómico para planificación (HU10). Distinto de activo (gestión administrativa / HU11).';

CREATE INDEX IF NOT EXISTS lotes_finca_estado_cultivo_idx
  ON public.lotes (finca_id, estado_cultivo);

-- -----------------------------------------------------------------------------
-- Planes de siembra (HU10)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planes_siembra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  catalogo_material_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  fecha_proyectada date NOT NULL,
  confirmacion_erosion boolean NOT NULL DEFAULT false,
  notas text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.planes_siembra IS 'HU10 RF10: planificación de siembra por lote y material genético certificado.';
COMMENT ON COLUMN public.planes_siembra.confirmacion_erosion IS 'RN28: usuario confirmó riesgo cuando pendiente del lote > 12%.';

CREATE UNIQUE INDEX IF NOT EXISTS planes_siembra_one_active_per_lote_idx
  ON public.planes_siembra (lote_id)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS planes_siembra_finca_fecha_idx
  ON public.planes_siembra (finca_id, fecha_proyectada DESC);

DROP TRIGGER IF EXISTS trg_planes_siembra_lote_finca ON public.planes_siembra;
CREATE TRIGGER trg_planes_siembra_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.planes_siembra
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lote_matches_finca();

ALTER TABLE public.planes_siembra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planes_siembra_select ON public.planes_siembra;
CREATE POLICY planes_siembra_select ON public.planes_siembra
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS planes_siembra_insert ON public.planes_siembra;
CREATE POLICY planes_siembra_insert ON public.planes_siembra
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

DROP POLICY IF EXISTS planes_siembra_update ON public.planes_siembra;
CREATE POLICY planes_siembra_update ON public.planes_siembra
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
