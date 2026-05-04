-- HU13: operario marca inspección como completada (solo estado + updated_at; resto inmutable).

CREATE OR REPLACE FUNCTION public.enforce_monitoreo_operario_update_shape()
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

  IF OLD.assigned_to IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'pendiente'::public.monitoreo_fitosanitario_estado
     AND NEW.estado = 'completada'::public.monitoreo_fitosanitario_estado THEN
    IF NEW.finca_id IS DISTINCT FROM OLD.finca_id
       OR NEW.lote_id IS DISTINCT FROM OLD.lote_id
       OR NEW.fecha_inspeccion IS DISTINCT FROM OLD.fecha_inspeccion
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.notas IS DISTINCT FROM OLD.notas
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.is_voided IS DISTINCT FROM OLD.is_voided
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Operario: solo puede marcar la inspección como completada sin modificar otros datos.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.estado = 'pendiente'::public.monitoreo_fitosanitario_estado THEN
    RAISE EXCEPTION 'Operario: no puede editar esta programación; use «Marcar realizada» si ya ejecutó la visita.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_monitoreo_operario_update_shape() IS 'HU13: operario solo puede pasar pendiente→completada sin cambiar demás columnas.';

DROP TRIGGER IF EXISTS trg_monitoreos_fitos_prog_operario_shape ON public.monitoreos_fitosanitarios_programados;
CREATE TRIGGER trg_monitoreos_fitos_prog_operario_shape
  BEFORE UPDATE ON public.monitoreos_fitosanitarios_programados
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_monitoreo_operario_update_shape();

DROP POLICY IF EXISTS monitoreos_fitos_prog_update_operario_completar ON public.monitoreos_fitosanitarios_programados;
CREATE POLICY monitoreos_fitos_prog_update_operario_completar ON public.monitoreos_fitosanitarios_programados
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    AND finca_id = public.current_user_finca_id()
    AND estado = 'pendiente'::public.monitoreo_fitosanitario_estado
    AND is_voided = false
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role = 'operario'::public.user_role
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND finca_id = public.current_user_finca_id()
    AND estado = 'completada'::public.monitoreo_fitosanitario_estado
    AND is_voided = false
  );
