-- HU19 / RF19: preparación de terreno en lote planificado (RN53–RN55).

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'lote_estado_cultivo'
      AND e.enumlabel = 'listo_para_siembra'
  ) THEN
    ALTER TYPE public.lote_estado_cultivo ADD VALUE 'listo_para_siembra';
  END IF;
END
$migration$;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preparacion_terreno_estado') THEN
    CREATE TYPE public.preparacion_terreno_estado AS ENUM (
      'aprobado',
      'pendiente_validacion_tecnico'
    );
  END IF;
END
$guard$;

COMMENT ON TYPE public.preparacion_terreno_estado IS
  'HU19: aprobado (<12% pendiente o validado por técnico); pendiente_validacion_tecnico si pendiente ≥ 12%.';

CREATE TABLE IF NOT EXISTS public.preparaciones_terreno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  plan_siembra_id uuid NOT NULL REFERENCES public.planes_siembra (id) ON DELETE RESTRICT,
  pendiente_final_pct numeric(5, 2) NOT NULL,
  actividades text[] NOT NULL,
  estado public.preparacion_terreno_estado NOT NULL,
  notas text,
  validado_por uuid REFERENCES auth.users (id),
  validado_en timestamptz,
  observacion_validacion text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preparaciones_terreno_pendiente_rango_chk CHECK (
    pendiente_final_pct >= 0 AND pendiente_final_pct <= 100
  ),
  CONSTRAINT preparaciones_terreno_actividades_chk CHECK (
    array_length(actividades, 1) >= 1
  )
);

COMMENT ON TABLE public.preparaciones_terreno IS
  'HU19 RF19: adecuación física del lote previa a siembra (RN54–RN55).';

CREATE UNIQUE INDEX IF NOT EXISTS preparaciones_terreno_lote_activo_uidx
  ON public.preparaciones_terreno (lote_id)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS preparaciones_terreno_finca_created_idx
  ON public.preparaciones_terreno (finca_id, created_at DESC)
  WHERE is_voided = false;

DROP TRIGGER IF EXISTS trg_preparaciones_terreno_lote_finca ON public.preparaciones_terreno;
CREATE TRIGGER trg_preparaciones_terreno_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.preparaciones_terreno
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

ALTER TABLE public.preparaciones_terreno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS preparaciones_terreno_select ON public.preparaciones_terreno;
CREATE POLICY preparaciones_terreno_select ON public.preparaciones_terreno
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS preparaciones_terreno_insert ON public.preparaciones_terreno;
CREATE POLICY preparaciones_terreno_insert ON public.preparaciones_terreno
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

DROP POLICY IF EXISTS preparaciones_terreno_update ON public.preparaciones_terreno;
CREATE POLICY preparaciones_terreno_update ON public.preparaciones_terreno
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'admin'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );
