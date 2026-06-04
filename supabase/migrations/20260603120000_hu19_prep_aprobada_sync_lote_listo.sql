-- HU19: al aprobar preparación de terreno, sincronizar lote → listo_para_siembra.
-- El operario puede INSERT en preparaciones_terreno pero no UPDATE en lotes (RLS);
-- este trigger corre con privilegios elevados solo en la transición planificado → listo.

CREATE OR REPLACE FUNCTION public.trg_preparacion_terreno_sync_lote_listo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_voided THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM 'aprobado'::public.preparacion_terreno_estado THEN
    RETURN NEW;
  END IF;

  UPDATE public.lotes
  SET
    estado_cultivo = 'listo_para_siembra',
    pendiente_pct = NEW.pendiente_final_pct,
    updated_at = now()
  WHERE id = NEW.lote_id
    AND finca_id = NEW.finca_id
    AND activo = true
    AND estado_cultivo = 'planificado_siembra';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_preparacion_terreno_sync_lote_listo() IS
  'HU19: cuando preparación queda aprobada, pasa el lote de planificado_siembra a listo_para_siembra (bypass RLS lotes_update para operario).';

DROP TRIGGER IF EXISTS trg_preparacion_terreno_sync_lote_listo ON public.preparaciones_terreno;
CREATE TRIGGER trg_preparacion_terreno_sync_lote_listo
  AFTER INSERT OR UPDATE OF estado, is_voided, pendiente_final_pct
  ON public.preparaciones_terreno
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_preparacion_terreno_sync_lote_listo();

-- Datos existentes: prep. aprobada pero lote aún planificado (p. ej. registro por operario antes de este fix).
UPDATE public.lotes l
SET
  estado_cultivo = 'listo_para_siembra',
  pendiente_pct = pt.pendiente_final_pct,
  updated_at = now()
FROM public.preparaciones_terreno pt
WHERE pt.lote_id = l.id
  AND pt.is_voided = false
  AND pt.estado = 'aprobado'::public.preparacion_terreno_estado
  AND l.estado_cultivo = 'planificado_siembra'::public.lote_estado_cultivo
  AND l.activo = true;
