-- HU13 RF13 / CU13: programación de monitoreos fitosanitarios por lote, fecha y operario asignado.

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'monitoreo_fitosanitario_estado') THEN
    CREATE TYPE public.monitoreo_fitosanitario_estado AS ENUM (
      'pendiente',
      'completada',
      'anulada'
    );
  END IF;
END
$guard$;

COMMENT ON TYPE public.monitoreo_fitosanitario_estado IS 'HU13: estado de la inspección programada (pendiente / completada / anulada).';

CREATE TABLE IF NOT EXISTS public.monitoreos_fitosanitarios_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  fecha_inspeccion date NOT NULL,
  assigned_to uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  notas text,
  estado public.monitoreo_fitosanitario_estado NOT NULL DEFAULT 'pendiente',
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.monitoreos_fitosanitarios_programados IS 'HU13 RF13: inspección fitosanitaria programada por lote, fecha y operario (RN35–RN37).';
COMMENT ON COLUMN public.monitoreos_fitosanitarios_programados.assigned_to IS 'Operario asignado (perfil de la misma finca).';
COMMENT ON COLUMN public.monitoreos_fitosanitarios_programados.is_voided IS 'Anulación lógica; combinado con estado anulada para CU13 / auditoría.';

CREATE INDEX IF NOT EXISTS monitoreos_fitos_prog_finca_fecha_idx
  ON public.monitoreos_fitosanitarios_programados (finca_id, fecha_inspeccion)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS monitoreos_fitos_prog_assigned_pendiente_idx
  ON public.monitoreos_fitosanitarios_programados (assigned_to, fecha_inspeccion)
  WHERE is_voided = false AND estado = 'pendiente'::public.monitoreo_fitosanitario_estado;

-- CU13: un solo pendiente por lote + fecha civil de inspección.
CREATE UNIQUE INDEX IF NOT EXISTS monitoreos_fitos_prog_lote_fecha_pendiente_uidx
  ON public.monitoreos_fitosanitarios_programados (lote_id, fecha_inspeccion)
  WHERE estado = 'pendiente'::public.monitoreo_fitosanitario_estado
    AND is_voided = false;

DROP TRIGGER IF EXISTS trg_monitoreos_fitos_prog_lote_finca ON public.monitoreos_fitosanitarios_programados;
CREATE TRIGGER trg_monitoreos_fitos_prog_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.monitoreos_fitosanitarios_programados
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lote_matches_finca();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.monitoreos_fitosanitarios_programados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monitoreos_fitos_prog_select ON public.monitoreos_fitosanitarios_programados;
CREATE POLICY monitoreos_fitos_prog_select ON public.monitoreos_fitosanitarios_programados
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'admin'::public.user_role)
      )
    )
    OR (
      assigned_to = auth.uid()
      AND finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role = 'operario'::public.user_role
      )
    )
  );

DROP POLICY IF EXISTS monitoreos_fitos_prog_insert ON public.monitoreos_fitosanitarios_programados;
CREATE POLICY monitoreos_fitos_prog_insert ON public.monitoreos_fitosanitarios_programados
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

DROP POLICY IF EXISTS monitoreos_fitos_prog_update ON public.monitoreos_fitosanitarios_programados;
CREATE POLICY monitoreos_fitos_prog_update ON public.monitoreos_fitosanitarios_programados
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
-- HU13: agrónomo debe poder listar operarios de su finca (combo assigned_to).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_superadmin()
    OR (
      public.is_finca_admin()
      AND finca_id = public.current_user_finca_id()
      AND role <> 'superadmin'::public.user_role
    )
    OR (
      finca_id = public.current_user_finca_id()
      AND role = 'operario'::public.user_role
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role = 'agronomo'::public.user_role
      )
    )
  );
