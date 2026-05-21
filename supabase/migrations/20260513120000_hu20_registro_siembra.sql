-- HU20 / RF20: registro de siembra de plántulas en campo (RN56–RN58).

CREATE TABLE IF NOT EXISTS public.registros_siembra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  plan_siembra_id uuid NOT NULL REFERENCES public.planes_siembra (id) ON DELETE RESTRICT,
  preparacion_terreno_id uuid NOT NULL REFERENCES public.preparaciones_terreno (id) ON DELETE RESTRICT,
  catalogo_material_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  fecha_siembra date NOT NULL,
  cantidad_palmas integer NOT NULL,
  confirmacion_profundidad boolean NOT NULL DEFAULT false,
  confirmacion_orientacion boolean NOT NULL DEFAULT false,
  notas text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registros_siembra_cantidad_chk CHECK (cantidad_palmas > 0),
  CONSTRAINT registros_siembra_confirmaciones_chk CHECK (
    confirmacion_profundidad = true AND confirmacion_orientacion = true
  )
);

COMMENT ON TABLE public.registros_siembra IS
  'HU20 RF20: siembra de plántulas vinculada a plan HU10 y preparación HU19.';

CREATE UNIQUE INDEX IF NOT EXISTS registros_siembra_lote_activo_uidx
  ON public.registros_siembra (lote_id)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS registros_siembra_finca_fecha_idx
  ON public.registros_siembra (finca_id, fecha_siembra DESC)
  WHERE is_voided = false;

DROP TRIGGER IF EXISTS trg_registros_siembra_lote_finca ON public.registros_siembra;
CREATE TRIGGER trg_registros_siembra_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.registros_siembra
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

ALTER TABLE public.registros_siembra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registros_siembra_select ON public.registros_siembra;
CREATE POLICY registros_siembra_select ON public.registros_siembra
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS registros_siembra_insert ON public.registros_siembra;
CREATE POLICY registros_siembra_insert ON public.registros_siembra
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
    )
  );

DROP POLICY IF EXISTS registros_siembra_update ON public.registros_siembra;
CREATE POLICY registros_siembra_update ON public.registros_siembra
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );
