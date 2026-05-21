-- HU24 / RF24 (sanidad): censo sanitario por lote con incidencia (RN68–RN70).

CREATE TABLE IF NOT EXISTS public.censos_sanitarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  catalogo_item_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  fecha_censo date NOT NULL DEFAULT (CURRENT_DATE),
  palmas_inspeccionadas integer NOT NULL,
  palmas_afectadas integer NOT NULL DEFAULT 0,
  incidencia_pct numeric(6, 2) NOT NULL,
  supera_umbral boolean NOT NULL DEFAULT false,
  notas text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT censos_sanitarios_palmas_inspeccionadas_chk CHECK (palmas_inspeccionadas > 0),
  CONSTRAINT censos_sanitarios_palmas_afectadas_chk CHECK (palmas_afectadas >= 0),
  CONSTRAINT censos_sanitarios_palmas_coherentes_chk CHECK (
    palmas_afectadas <= palmas_inspeccionadas
  ),
  CONSTRAINT censos_sanitarios_incidencia_rango_chk CHECK (
    incidencia_pct >= 0 AND incidencia_pct <= 100
  )
);

COMMENT ON TABLE public.censos_sanitarios IS
  'HU24 RF24: censo fitosanitario por lote; incidencia = (afectadas/inspeccionadas)*100 (RN70).';

CREATE INDEX IF NOT EXISTS censos_sanitarios_finca_fecha_idx
  ON public.censos_sanitarios (finca_id, fecha_censo DESC)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS censos_sanitarios_lote_idx
  ON public.censos_sanitarios (lote_id, fecha_censo DESC)
  WHERE is_voided = false;

-- Catálogo = plaga o enfermedad activa (RN68)
CREATE OR REPLACE FUNCTION public.enforce_censo_sanitario_catalogo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalogo_items ci
    WHERE ci.id = NEW.catalogo_item_id
      AND ci.activo = true
      AND ci.categoria IN (
        'plaga'::public.catalogo_categoria,
        'enfermedad'::public.catalogo_categoria
      )
  ) THEN
    RAISE EXCEPTION 'El censo debe vincularse a una plaga o enfermedad activa del catálogo (RN68).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_censo_sanitario_catalogo ON public.censos_sanitarios;
CREATE TRIGGER trg_censo_sanitario_catalogo
  BEFORE INSERT OR UPDATE OF catalogo_item_id ON public.censos_sanitarios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_censo_sanitario_catalogo();

DROP TRIGGER IF EXISTS trg_censos_sanitarios_lote_finca ON public.censos_sanitarios;
CREATE TRIGGER trg_censos_sanitarios_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.censos_sanitarios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lote_matches_finca();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.censos_sanitarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS censos_sanitarios_select ON public.censos_sanitarios;
CREATE POLICY censos_sanitarios_select ON public.censos_sanitarios
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS censos_sanitarios_insert ON public.censos_sanitarios;
CREATE POLICY censos_sanitarios_insert ON public.censos_sanitarios
  FOR INSERT TO authenticated
  WITH CHECK (
    finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND is_voided = false
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN (
          'operario'::public.user_role,
          'agronomo'::public.user_role
        )
    )
  );

DROP POLICY IF EXISTS censos_sanitarios_update ON public.censos_sanitarios;
CREATE POLICY censos_sanitarios_update ON public.censos_sanitarios
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_finca_admin()
      AND finca_id = public.current_user_finca_id()
    )
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role = 'operario'::public.user_role
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );
