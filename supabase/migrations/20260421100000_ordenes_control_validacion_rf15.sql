-- =============================================================================
-- SIG-Palma: RF15 validación fitosanitaria + órdenes de control + aplicaciones (RF23)
-- Migration: 20260421100000
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Alertas: estado de validación técnica (RF15)
-- -----------------------------------------------------------------------------
ALTER TABLE public.alertas_fitosanitarias
  ADD COLUMN IF NOT EXISTS validacion_estado text NOT NULL DEFAULT 'pendiente'
    CHECK (validacion_estado IN ('pendiente', 'validado', 'rechazado', 'invalidado'));

ALTER TABLE public.alertas_fitosanitarias
  ADD COLUMN IF NOT EXISTS validacion_diagnostico text,
  ADD COLUMN IF NOT EXISTS validado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validado_en timestamptz;

COMMENT ON COLUMN public.alertas_fitosanitarias.validacion_estado IS
  'RF15: pendiente hasta que técnico valide; validado habilita orden de control.';

-- -----------------------------------------------------------------------------
-- Órdenes de control (tratamiento autorizado tras validación)
-- -----------------------------------------------------------------------------
CREATE TYPE public.orden_control_estado AS ENUM ('autorizada', 'cerrada', 'cancelada');

CREATE TABLE IF NOT EXISTS public.ordenes_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  alerta_id uuid NOT NULL REFERENCES public.alertas_fitosanitarias (id) ON DELETE RESTRICT,
  insumo_catalogo_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  dosis_recomendada text NOT NULL,
  observaciones_tecnico text,
  estado public.orden_control_estado NOT NULL DEFAULT 'autorizada',
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ordenes_control_alerta_unique UNIQUE (alerta_id)
);

CREATE INDEX IF NOT EXISTS ordenes_control_finca_estado_idx
  ON public.ordenes_control (finca_id, estado);

DROP TRIGGER IF EXISTS trg_ordenes_control_lote_finca ON public.ordenes_control;
CREATE TRIGGER trg_ordenes_control_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.ordenes_control
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

-- -----------------------------------------------------------------------------
-- Aplicaciones fitosanitarias (operario ejecuta orden; RN-11 EPP en app)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aplicaciones_fitosanitarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES public.ordenes_control (id) ON DELETE RESTRICT,
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  catalogo_item_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  fecha_aplicacion date NOT NULL,
  cantidad_aplicada numeric(14, 4) NOT NULL,
  unidad_medida text,
  epp_confirmado boolean NOT NULL DEFAULT false,
  latitud numeric(10, 7),
  longitud numeric(10, 7),
  notas text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  source public.registro_source NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aplicaciones_orden_unique UNIQUE (orden_id)
);

CREATE INDEX IF NOT EXISTS aplicaciones_fitosanitarias_finca_fecha_idx
  ON public.aplicaciones_fitosanitarias (finca_id, fecha_aplicacion DESC);

DROP TRIGGER IF EXISTS trg_aplicaciones_lote_finca ON public.aplicaciones_fitosanitarias;
CREATE TRIGGER trg_aplicaciones_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.aplicaciones_fitosanitarias
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

-- Cierra la orden al registrar la aplicación (RF23 poscondición)
CREATE OR REPLACE FUNCTION public.trg_aplicacion_cierra_orden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ordenes_control
  SET estado = 'cerrada'::public.orden_control_estado,
      updated_at = now()
  WHERE id = NEW.orden_id
    AND estado = 'autorizada'::public.orden_control_estado;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicacion_cierra_orden ON public.aplicaciones_fitosanitarias;
CREATE TRIGGER trg_aplicacion_cierra_orden
  AFTER INSERT ON public.aplicaciones_fitosanitarias
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aplicacion_cierra_orden();

-- -----------------------------------------------------------------------------
-- RLS: reemplazar política de UPDATE de alertas (solo técnico/admin, no operario)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS alertas_update ON public.alertas_fitosanitarias;
CREATE POLICY alertas_update ON public.alertas_fitosanitarias
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- RLS: ordenes_control
-- -----------------------------------------------------------------------------
ALTER TABLE public.ordenes_control ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ordenes_control_select ON public.ordenes_control;
CREATE POLICY ordenes_control_select ON public.ordenes_control
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS ordenes_control_insert ON public.ordenes_control;
CREATE POLICY ordenes_control_insert ON public.ordenes_control
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
          AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
      )
    )
  );

DROP POLICY IF EXISTS ordenes_control_update ON public.ordenes_control;
CREATE POLICY ordenes_control_update ON public.ordenes_control
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- RLS: aplicaciones_fitosanitarias
-- -----------------------------------------------------------------------------
ALTER TABLE public.aplicaciones_fitosanitarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aplicaciones_fitosanitarias_select ON public.aplicaciones_fitosanitarias;
CREATE POLICY aplicaciones_fitosanitarias_select ON public.aplicaciones_fitosanitarias
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS aplicaciones_fitosanitarias_insert ON public.aplicaciones_fitosanitarias;
CREATE POLICY aplicaciones_fitosanitarias_insert ON public.aplicaciones_fitosanitarias
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
        SELECT 1 FROM public.ordenes_control o
        WHERE o.id = orden_id
          AND o.finca_id = public.current_user_finca_id()
          AND o.estado = 'autorizada'::public.orden_control_estado
      )
    )
  );

DROP POLICY IF EXISTS aplicaciones_fitosanitarias_update ON public.aplicaciones_fitosanitarias;
CREATE POLICY aplicaciones_fitosanitarias_update ON public.aplicaciones_fitosanitarias
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
