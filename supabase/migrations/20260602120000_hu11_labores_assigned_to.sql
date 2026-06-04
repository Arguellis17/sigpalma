-- HU11/HU21: asignación de operario en labores programadas (patrón HU13 monitoreos).

ALTER TABLE public.labores_agronomicas
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.labores_agronomicas.assigned_to IS
  'Operario asignado para ejecutar la labor (misma finca). NULL = visible para todos los operarios de la finca (registros legacy).';

CREATE INDEX IF NOT EXISTS labores_agronomicas_assigned_pendiente_idx
  ON public.labores_agronomicas (assigned_to, fecha_ejecucion)
  WHERE is_voided = false AND cantidad_ejecutada IS NULL;

-- -----------------------------------------------------------------------------
-- RLS: operario solo ve labores asignadas a él o sin asignar (legacy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS labores_select ON public.labores_agronomicas;
CREATE POLICY labores_select ON public.labores_agronomicas
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
      finca_id = public.current_user_finca_id()
      AND (assigned_to = auth.uid() OR assigned_to IS NULL)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role = 'operario'::public.user_role
      )
    )
  );

-- -----------------------------------------------------------------------------
-- HU28: operario no puede marcar herramienta dañada/perdida vía API directa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_inventario_operario_estado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_operario boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active = true
      AND p.role = 'operario'::public.user_role
  ) INTO v_is_operario;

  IF NOT v_is_operario THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IN ('danada'::public.inventario_herramienta_estado, 'perdida'::public.inventario_herramienta_estado) THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar daño o pérdida de herramientas.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_inventario_operario_estado() IS
  'HU28: operario solo toma/devuelve; daño/pérdida reservado a administradores.';

DROP TRIGGER IF EXISTS trg_inventario_herramienta_operario_estado ON public.inventario_herramientas;
CREATE TRIGGER trg_inventario_herramienta_operario_estado
  BEFORE UPDATE OF estado ON public.inventario_herramientas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_inventario_operario_estado();
